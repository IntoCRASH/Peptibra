import { createSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function GET(request:Request){const s=await createSupabaseServer();await s.auth.signOut();return NextResponse.redirect(new URL("/",request.url))}

