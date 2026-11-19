import { createBearerSession, verifyPassword } from "@/lib/cloudflare/auth";
import { d1 } from "@/lib/cloudflare/d1";

type LoginUser = {
  id: string;
  email: string;
  password_hash: string;
  role: "admin" | "socio" | "vendedor";
  team_id: number | null;
  active: number;
  must_change_password: number;
};

export async function POST(request: Request) {
  const body = await request.json() as { email?: string; password?: string };
  const email = String(body.email || "").trim().toLowerCase();
  const user = await d1.prepare(
    "SELECT id,email,password_hash,role,team_id,active,must_change_password FROM auth_users WHERE email=?",
  ).bind(email).first<LoginUser>();
  if (!user || !user.active || !await verifyPassword(String(body.password || ""), user.password_hash)) {
    return Response.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }
  return Response.json({
    access_token: await createBearerSession(user.id),
    token_type: "bearer",
    expires_in: 86400,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      teamId: user.team_id,
      mustChangePassword: Boolean(user.must_change_password),
    },
  });
}
