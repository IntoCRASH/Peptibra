import { getAuthorizedUser } from "@/app/chatgpt-auth";
import { cloudDb } from "@/lib/cloudflare/supabase-compat";

const validRate = (value: unknown) => {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 20 && rate < 200 ? rate : 0;
};

export async function GET() {
  const user = await getAuthorizedUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 403 });
  const keys = ["dop_buy_rate", "dop_sell_rate", "dop_rate_updated", "dop_rate_date", "dop_rate_source"];
  const { data: rows } = await cloudDb.from("app_settings").select("*").in("key", keys);
  const settings = new Map((rows || []).map((row: Record<string, unknown>) => [String(row.key), String(row.value || "")]));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" });
  const stored = validRate(settings.get("dop_sell_rate"));
  if (stored && settings.get("dop_rate_date") === today) {
    return Response.json({ rate: stored, buyRate: validRate(settings.get("dop_buy_rate")), source: settings.get("dop_rate_source") || "InfoDólar", updatedAt: settings.get("dop_rate_updated"), stale: false });
  }
  try {
    const response = await fetch("https://www.infodolar.com.do/", { headers: { "user-agent": "Mozilla/5.0 PEPTIBRA/2.0" }, next: { revalidate: 21600 } });
    if (!response.ok) throw new Error("Fuente de tasa no disponible");
    const html = await response.text();
    const match = html.match(/Promedio\s+InfoDolar[^]*?data-order="\$([0-9.,]+)"[^]*?data-order="\$([0-9.,]+)"/i);
    const buyRate = validRate(match?.[1]?.replace(/,/g, ""));
    const rate = validRate(match?.[2]?.replace(/,/g, ""));
    if (!buyRate || !rate || rate < buyRate) throw new Error("InfoDólar no publicó una tasa válida");
    const updatedAt = new Date().toISOString();
    const values = [["dop_buy_rate", buyRate], ["dop_sell_rate", rate], ["dop_rate_updated", updatedAt], ["dop_rate_date", today], ["dop_rate_source", "InfoDólar"]];
    for (const [key, value] of values) {
      const { error } = await cloudDb.from("app_settings").upsert({ key, value: String(value), updated_at: updatedAt }, { onConflict: "key" });
      if (error) throw new Error(error.message);
    }
    return Response.json({ rate, buyRate, source: "InfoDólar", updatedAt, stale: false });
  } catch (error) {
    if (stored) return Response.json({ rate: stored, buyRate: validRate(settings.get("dop_buy_rate")), source: settings.get("dop_rate_source") || "última tasa", updatedAt: settings.get("dop_rate_updated"), stale: true });
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo obtener la tasa" }, { status: 503 });
  }
}
