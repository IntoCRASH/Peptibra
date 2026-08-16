import { createClient } from "@supabase/supabase-js";

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
