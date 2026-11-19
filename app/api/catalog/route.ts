import { cloudDb } from "@/lib/cloudflare/supabase-compat";

type Row = Record<string, unknown>;
type CatalogConfig = { order: string[]; visible: string[] };

function readCatalogConfig(value: unknown): CatalogConfig | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed)) {
      const names = parsed.map(String);
      return { order: names, visible: names };
    }
    if (parsed && typeof parsed === "object") {
      return {
        order: Array.isArray(parsed.order) ? parsed.order.map(String) : [],
        visible: Array.isArray(parsed.visible) ? parsed.visible.map(String) : [],
      };
    }
  } catch {
    return null;
  }
  return null;
}

export async function GET() {
  try {
    const [
      { data: products, error: productsError },
      { data: profiles, error: profilesError },
      { data: setting, error: settingError },
      { data: publicNamesSetting, error: publicNamesError },
      { data: stock, error: stockError },
      { data: bacRules, error: bacRulesError },
    ] = await Promise.all([
      cloudDb.from("products").select("*"),
      cloudDb.from("product_profiles").select("*"),
      cloudDb.from("app_settings").select("*").eq("key", "web_catalog_names").maybeSingle(),
      cloudDb.from("app_settings").select("*").eq("key", "product_public_names").maybeSingle(),
      cloudDb.from("inventory_balances").select("*"),
      cloudDb.from("app_settings").select("*").in("key", ["bac_free_enabled", "bac_free_threshold_usd"]),
    ]);
    if (productsError || profilesError || settingError || publicNamesError || stockError || bacRulesError) {
      throw productsError || profilesError || settingError || publicNamesError || stockError || bacRulesError;
    }

    const config = readCatalogConfig(setting?.value);
    const visibleNames = config ? new Set(config.visible) : null;
    const order = new Map((config?.order || []).map((name, index) => [name, index]));
    let publicNames: Record<string, string> = {};
    try {
      const parsed = JSON.parse(String(publicNamesSetting?.value || "{}"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        publicNames = Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value || "").trim()]));
      }
    } catch {}
    const profileMap = new Map<number, Row>((profiles || []).map((profile: Row) => [Number(profile.product_id), profile]));
    const stockMap = new Map<number, number>();
    for (const row of stock || []) {
      const productId = Number(row.product_id);
      stockMap.set(productId, (stockMap.get(productId) || 0) + Number(row.quantity || 0));
    }
    const serialize = (product: Row) => {
      const profile = profileMap.get(Number(product.id));
      return {
        id: product.id,
        name: publicNames[String(product.name)] || product.name,
        concentration: product.concentration,
        price: Number(profile?.normal_price || product.price || 0),
        stock: stockMap.get(Number(product.id)) || 0,
        description: String(profile?.description || ""),
        photoKey: String(profile?.photo_key || ""),
        category: String(product.category || "Péptido"),
      };
    };
    const active = (products || []).filter((product: Row) => product.status === "active");
    const visible = active
      .filter((product: Row) => !visibleNames || visibleNames.has(String(product.name)))
      .sort((a: Row, b: Row) => {
        const aName = String(a.name), bName = String(b.name);
        const aOrder = order.get(aName) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = order.get(bName) ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder || aName.localeCompare(bName, "es") || String(a.concentration).localeCompare(String(b.concentration), "es", { numeric: true });
      });
    const bacSuggestions = active.filter((product: Row) =>
      /bac water|bacteriost/i.test(`${String(product.name)} ${String(product.category || "")}`),
    );
    const bacRuleMap = new Map((bacRules || []).map((row: Row) => [String(row.key), String(row.value)]));
    return Response.json({
      products: visible.map(serialize),
      bacSuggestions: bacSuggestions.map(serialize),
      bacOffer: { enabled: bacRuleMap.get("bac_free_enabled") !== "0", threshold: Math.max(0, Number(bacRuleMap.get("bac_free_threshold_usd") || 200)) },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el catálogo" },
      { status: 500 },
    );
  }
}
