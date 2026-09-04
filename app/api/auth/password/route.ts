import { currentUser, hashPassword, verifyPassword } from "@/lib/cloudflare/auth";
import { d1 } from "@/lib/cloudflare/d1";
export async function POST(request: Request) {
  const user = await currentUser(); if (!user) return Response.json({ error: "La sesión ya no es válida." }, { status: 401 });
  const body = await request.json() as { current?: string; next?: string }, next = String(body.next || "");
  if (next.length < 10) return Response.json({ error: "La contraseña nueva debe tener al menos 10 caracteres." }, { status: 400 });
  const account = await d1.prepare("SELECT password_hash FROM auth_users WHERE id=?").bind(user.id).first<{password_hash:string}>();
  if (!account || !await verifyPassword(String(body.current || ""), account.password_hash)) return Response.json({ error: "La contraseña actual no es correcta." }, { status: 400 });
  await d1.prepare("UPDATE auth_users SET password_hash=?,must_change_password=0,updated_at=? WHERE id=?").bind(await hashPassword(next), new Date().toISOString(), user.id).run();
  return Response.json({ ok: true });
}
