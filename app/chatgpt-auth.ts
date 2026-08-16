import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export type ChatGPTUser = { userId:string; displayName:string; email:string; fullName:string|null };
const AUTHORIZED_EMAILS = new Set(["cruzmonty1983@gmail.com"]);

export async function getAuthorizedUser(): Promise<ChatGPTUser|null> {
  const supabase=await createSupabaseServer();
  const {data:{user}}=await supabase.auth.getUser();
  const email=user?.email?.trim().toLowerCase();
  if(!user||!email||!AUTHORIZED_EMAILS.has(email)) return null;
  const fullName=String(user.user_metadata?.full_name||"").trim()||null;
  return {userId:user.id,email,fullName,displayName:fullName||email.split("@")[0]};
}
export async function requireAuthorizedUser(returnTo:string){const user=await getAuthorizedUser();if(!user)redirect(`/login?next=${encodeURIComponent(returnTo)}`);return user;}
export const getChatGPTUser=getAuthorizedUser;
export const requireChatGPTUser=requireAuthorizedUser;
export function chatGPTSignInPath(returnTo:string){return `/login?next=${encodeURIComponent(returnTo)}`;}
export function chatGPTSignOutPath(returnTo="/"){return `/auth/signout?return_to=${encodeURIComponent(returnTo)}`;}
