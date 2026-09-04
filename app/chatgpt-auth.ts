import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cloudflare/auth";
import { cloudDb } from "@/lib/cloudflare/supabase-compat";

export type AccessRole = "admin" | "socio" | "vendedor";
export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  role: AccessRole;
  teamId: number | null;
  partnerId: number | null;
};

export async function getAuthorizedUser(): Promise<ChatGPTUser | null> {
  const user = await currentUser();
  const email = user?.email?.trim().toLowerCase();
  if (!user || !email) return null;
  const cloud = cloudDb;
  const { data: profile } = await cloud.from("user_profiles").select("*").eq("email", email).eq("active", 1).maybeSingle();
  if (!profile) return null;
  let partnerId: number | null = null;
  let teamName = "";
  if (profile.team_id) {
    const { data: member } = await cloud.from("team").select("name,partner_id,active").eq("id", profile.team_id).maybeSingle();
    if (!member || Number(member.active) !== 1) return null;
    partnerId = profile.role === "socio" ? Number(profile.team_id) : Number(member.partner_id) || null;
    teamName = String(member.name || "").trim();
  }
  const fullName = teamName || null;
  return { userId: user.id, email, fullName, displayName: fullName || email.split("@")[0], role: profile.role as AccessRole, teamId: profile.team_id ? Number(profile.team_id) : null, partnerId };
}

export async function requireAuthorizedUser(returnTo: string) { const user = await getAuthorizedUser(); if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`); return user; }
export const getChatGPTUser = getAuthorizedUser;
export const requireChatGPTUser = requireAuthorizedUser;
export function chatGPTSignInPath(returnTo: string) { return `/login?next=${encodeURIComponent(returnTo)}`; }
export function chatGPTSignOutPath(returnTo = "/") { return `/auth/signout?return_to=${encodeURIComponent(returnTo)}`; }
