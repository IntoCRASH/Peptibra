import { cookies } from "next/headers";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { d1 } from "./d1";

const scrypt = promisify(scryptCallback);
const COOKIE = "ptbr_session";
export type CloudUser = { id: string; email: string; role: "admin" | "socio" | "vendedor"; team_id: number | null; active: number; must_change_password: number };
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function hashPassword(password: string) { const salt = randomBytes(16).toString("base64url"); const key = await scrypt(password, salt, 64) as Buffer; return `scrypt$${salt}$${key.toString("base64url")}`; }
export async function verifyPassword(password: string, stored: string) { const [kind, salt, encoded] = stored.split("$"); if (kind !== "scrypt" || !salt || !encoded) return false; const expected = Buffer.from(encoded, "base64url"); const actual = await scrypt(password, salt, expected.length) as Buffer; return expected.length === actual.length && timingSafeEqual(expected, actual); }

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url"), now = new Date(), expires = new Date(now.getTime() + 14 * 86400000);
  await d1.prepare("INSERT INTO auth_sessions(id_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(tokenHash(token), userId, expires.toISOString(), now.toISOString()).run();
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires });
}
export async function createBearerSession(userId: string) { const token=randomBytes(32).toString("base64url"),now=new Date(),expires=new Date(now.getTime()+86400000);await d1.prepare("INSERT INTO auth_sessions(id_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(tokenHash(token),userId,expires.toISOString(),now.toISOString()).run();return token; }
export async function userFromBearer(request:Request):Promise<CloudUser|null>{const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");if(!token)return null;return await d1.prepare("SELECT u.* FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.id_hash=? AND s.expires_at>? AND u.active=1").bind(tokenHash(token),new Date().toISOString()).first<CloudUser>()||null;}
export async function destroySession() { const store = await cookies(), token = store.get(COOKIE)?.value; if (token) await d1.prepare("DELETE FROM auth_sessions WHERE id_hash=?").bind(tokenHash(token)).run(); store.delete(COOKIE); }
export async function currentUser(): Promise<CloudUser | null> {
  const token = (await cookies()).get(COOKIE)?.value; if (!token) return null;
  const user = await d1.prepare("SELECT u.* FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.id_hash=? AND s.expires_at>? AND u.active=1").bind(tokenHash(token), new Date().toISOString()).first<CloudUser>();
  return user || null;
}
