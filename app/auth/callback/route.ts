import { createSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function GET(request:Request){const u=new URL(request.url),code=u.searchParams.get("code"),next=u.searchParams.get("next")||"/ptbr-mobile";if(code){const s=await createSupabaseServer();await s.auth.exchangeCodeForSession(code)}return NextResponse.redirect(new URL(next.startsWith("/")?next:"/ptbr-mobile",u.origin))}

