import { NextRequest, NextResponse } from "next/server";
import { d1 } from "@/lib/cloudflare/d1";

const COUNTER_KEY = "public_home_visits";
const COOKIE_NAME = "peptibra_visit_session";

async function currentCount() {
  const row = await d1.prepare("SELECT value FROM app_settings WHERE key=?").bind(COUNTER_KEY).first<{value:string}>();
  return Math.max(0, Number(row?.value || 0));
}

export async function POST(request: NextRequest) {
  try {
    if (request.cookies.get(COOKIE_NAME)?.value) {
      return NextResponse.json({ count: await currentCount(), counted: false });
    }
    const now = new Date().toISOString();
    const result = await d1.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES(?,'1',?) ON CONFLICT(key) DO UPDATE SET value=CAST(COALESCE(CAST(app_settings.value AS INTEGER),0)+1 AS TEXT),updated_at=excluded.updated_at RETURNING value").bind(COUNTER_KEY, now).all<{value:string}>();
    const count = Math.max(0, Number(result.results[0]?.value || 1));
    const response = NextResponse.json({ count, counted: true });
    response.cookies.set(COOKIE_NAME, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 60, path: "/" });
    return response;
  } catch {
    return NextResponse.json({ error: "No fue posible consultar el contador" }, { status: 500 });
  }
}
