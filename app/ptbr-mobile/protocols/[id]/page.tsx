import { redirect, notFound } from "next/navigation";
import { getAuthorizedUser } from "@/app/chatgpt-auth";
import { cloudDb } from "@/lib/cloudflare/supabase-compat";
import ProtocolPrint from "./ProtocolPrint";

export default async function ProtocolPage({params}:{params:Promise<{id:string}>}){
  const user=await getAuthorizedUser();
  if(!user)redirect("/login?next=/ptbr-mobile");
  const {id}=await params;
  const s=cloudDb;
  const {data:protocol}=await s.from("protocols").select("*").eq("id",id).maybeSingle();
  if(!protocol)notFound();
  const [{data:product},{data:profile}]=await Promise.all([
    s.from("products").select("*").eq("id",protocol.product_id).maybeSingle(),
    s.from("product_profiles").select("photo_key").eq("product_id",protocol.product_id).maybeSingle(),
  ]);
  const {data:safetySetting}=await s.from("app_settings").select("value").eq("key","product_safety_json").maybeSingle();
  let safety:Record<string,string>={};
  try{
    const allSafety=JSON.parse(String(safetySetting?.value||"{}"));
    const current=allSafety?.[String(protocol.product_id)];
    if(current&&typeof current==="object")safety={effects:String(current.effects||""),source:String(current.source||"")};
  }catch{/* Un dato antiguo o incompleto no debe impedir abrir el protocolo. */}
  return <ProtocolPrint protocol={protocol} product={{...(product||{}),photo_key:profile?.photo_key||""}} safety={safety}/>;
}
