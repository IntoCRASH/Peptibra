import { cloudDb } from "@/lib/cloudflare/supabase-compat";
import { userFromBearer } from "@/lib/cloudflare/auth";

const TABLES = [
  "calculations", "products", "product_profiles", "inventory_balances",
  "inventory_movements", "team", "clients", "invoices", "invoice_items",
  "payments", "cash_movements", "suppliers", "purchases", "protocols",
  "internal_withdrawals", "internal_withdrawal_payments", "supplier_payments",
  "legacy_sales", "app_settings",
];

async function authorized(request: Request) {
  const user=await userFromBearer(request);return Boolean(user&&user.role==="admin");
}

export async function GET(request: Request) {
  if (!await authorized(request)) return Response.json({ error: "No autorizado" }, { status: 403 });
  const cloud = cloudDb;
  try {
    const entries = await Promise.all(TABLES.map(async table => {
      const { data, error } = await cloud.from(table).select("*");
      if (error) throw error;
      return [table, data || []] as const;
    }));
    const tables = Object.fromEntries(entries) as Record<string, Record<string, unknown>[]>;
    const revision = tables.app_settings.find((x: Record<string, unknown>) => x.key === "mobile_data_revision")?.value || "";
    return Response.json({ schema: 1, generatedAt: new Date().toISOString(), revision, tables });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo preparar la sincronización" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await authorized(request)) return Response.json({ error: "No autorizado" }, { status: 403 });
  try {
    const payload = await request.json() as { replace?: boolean; tables?: Record<string, Record<string, unknown>[]>; image?: {productId:number,name:string,type:string,data:string} };
    if (payload.image) {
      const image=payload.image,key=`desktop-${payload.image.productId}-${Date.now()}-${payload.image.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const bytes=Buffer.from(image.data,"base64");
      if(bytes.length>8*1024*1024) return Response.json({error:"La imagen supera 8 MB"},{status:400});
      const upload=await fetch(`${process.env.PEPTIBRA_API_URL}/files/${encodeURIComponent(key)}`,{method:"PUT",headers:{"content-type":image.type||"image/png","x-peptibra-key":process.env.PEPTIBRA_API_SECRET!},body:bytes});if(!upload.ok)throw new Error("No se pudo subir la imagen");
      const {error:update}=await cloudDb.from("product_profiles").update({photo_key:key}).eq("product_id",image.productId);if(update)throw update;
      return Response.json({ok:true,key});
    }
    const supplied = payload.tables || {};
    const allowed = new Set(TABLES);
    const conflict: Record<string, string> = { product_profiles: "product_id", inventory_balances: "product_id,location", app_settings: "key" };
    if(payload.replace){
      const deleteOrder=["internal_withdrawal_payments","internal_withdrawals","supplier_payments","invoice_items","payments","cash_movements","invoices","legacy_sales","inventory_movements","inventory_balances","protocols","purchases","clients","product_profiles","products","suppliers","calculations","team"];
      for(const table of deleteOrder){const {error}=await cloudDb.from(table).delete();if(error)throw error;}
    }
    for(const table of TABLES){const rows=supplied[table]||[];if(!allowed.has(table)||!rows.length)continue;const {error}=await cloudDb.from(table).upsert(rows,{onConflict:conflict[table]||"id"});if(error)throw error;}
    const revision=new Date().toISOString();const {error}=await cloudDb.from("app_settings").upsert({key:"mobile_data_revision",value:revision,updated_at:revision},{onConflict:"key"});if(error)throw error;
    return Response.json({ ok: true, revision });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudieron subir los cambios" }, { status: 500 });
  }
}
