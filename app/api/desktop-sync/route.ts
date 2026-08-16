import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const TABLES = [
  "calculations", "products", "product_profiles", "inventory_balances",
  "inventory_movements", "team", "clients", "invoices", "invoice_items",
  "payments", "cash_movements", "suppliers", "purchases", "protocols",
  "internal_withdrawals", "internal_withdrawal_payments", "supplier_payments",
  "legacy_sales", "app_settings",
];

async function authorized(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const auth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user?.email) return false;
  const allowed = (process.env.MOBILE_ALLOWED_EMAILS || "cruzmonty1983@gmail.com")
    .split(",").map(x => x.trim().toLowerCase());
  return allowed.includes(data.user.email.toLowerCase());
}

export async function GET(request: Request) {
  if (!await authorized(request)) return Response.json({ error: "No autorizado" }, { status: 403 });
  const cloud = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  try {
    const entries = await Promise.all(TABLES.map(async table => {
      const { data, error } = await cloud.from(table).select("*");
      if (error) throw error;
      return [table, data || []] as const;
    }));
    const tables = Object.fromEntries(entries);
    const revision = tables.app_settings.find((x: Record<string, unknown>) => x.key === "mobile_data_revision")?.value || "";
    return Response.json({ schema: 1, generatedAt: new Date().toISOString(), revision, tables });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo preparar la sincronización" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await authorized(request)) return Response.json({ error: "No autorizado" }, { status: 403 });
  try {
    const payload = await request.json() as { tables?: Record<string, Record<string, unknown>[]>; image?: {productId:number,name:string,type:string,data:string} };
    if (payload.image) {
      const image=payload.image,key=`desktop-${payload.image.productId}-${Date.now()}-${payload.image.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const cloud=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
      const bytes=Buffer.from(image.data,"base64");
      if(bytes.length>8*1024*1024) return Response.json({error:"La imagen supera 8 MB"},{status:400});
      const {error}=await cloud.storage.from("product-images").upload(key,bytes,{contentType:image.type||"image/png",upsert:true});if(error)throw error;
      const {error:update}=await cloud.from("product_profiles").update({photo_key:key}).eq("product_id",image.productId);if(update)throw update;
      return Response.json({ok:true,key});
    }
    const supplied = payload.tables || {};
    const allowed = new Set(TABLES);
    const conflict: Record<string, string> = { product_profiles: "product_id", inventory_balances: "product_id,location", app_settings: "key" };
    const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require", max: 1, prepare: false });
    await sql.begin(async tx => {
      for (const table of TABLES) {
        const rows = supplied[table] || [];
        if (!allowed.has(table)) continue;
        for (const raw of rows) {
          const row = Object.fromEntries(Object.entries(raw).filter(([,v]) => v !== undefined));
          const columns = Object.keys(row);
          if (!columns.length) continue;
          const names = columns.map(x => `"${x}"`).join(",");
          const params = columns.map((_,i) => `$${i+1}`).join(",");
          const key = conflict[table] || "id";
          const updates = columns.filter(x => !key.split(",").includes(x)).map(x => `"${x}"=excluded."${x}"`).join(",");
          await tx.unsafe(`insert into "${table}" (${names}) values (${params}) on conflict (${key}) do ${updates ? `update set ${updates}` : "nothing"}`, Object.values(row));
        }
      }
      const revision = new Date().toISOString();
      await tx.unsafe(`insert into app_settings(key,value,updated_at) values('mobile_data_revision',$1::text,$1::timestamptz) on conflict(key) do update set value=$1::text,updated_at=$1::timestamptz`, [revision]);
      for (const table of TABLES.filter(x => !["product_profiles","inventory_balances","app_settings"].includes(x))) {
        await tx.unsafe(`select setval(pg_get_serial_sequence('${table}','id'), greatest(coalesce((select max(id) from "${table}"),1),1), true)`).catch(()=>{});
      }
    });
    await sql.end();
    return Response.json({ ok: true, revision: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudieron subir los cambios" }, { status: 500 });
  }
}
