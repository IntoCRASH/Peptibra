import { createSession, verifyPassword } from "@/lib/cloudflare/auth";
import { d1 } from "@/lib/cloudflare/d1";
export async function POST(request: Request) {
  const body = await request.json() as { email?: string; password?: string }, email = String(body.email || "").trim().toLowerCase(), password = String(body.password || "");
  const user = await d1.prepare("SELECT id,email,password_hash,active,must_change_password FROM auth_users WHERE email=?").bind(email).first<{id:string;email:string;password_hash:string;active:number;must_change_password:number}>();
  if (!user || !user.active || !await verifyPassword(password, user.password_hash)) return Response.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  await createSession(user.id); return Response.json({ ok: true, mustChangePassword: Boolean(user.must_change_password) });
}
