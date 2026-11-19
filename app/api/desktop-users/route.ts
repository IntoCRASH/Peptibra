import { getAuthorizedUser } from "@/app/chatgpt-auth";
import { cloudDb } from "@/lib/cloudflare/supabase-compat";
import { hashPassword, userFromBearer } from "@/lib/cloudflare/auth";
import { randomBytes } from "node:crypto";

type Row=Record<string,unknown>;
const service=()=>cloudDb;
const escapeHtml=(value:unknown)=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));

async function sendAccessEmail(email:string,name:string,password:string){
  const apiKey=process.env.RESEND_API_KEY;
  if(!apiKey)return {sent:false,error:"El servicio de correo no está configurado."};
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:`Bearer ${apiKey}`,"content-type":"application/json"},body:JSON.stringify({
    from:process.env.ACCESS_FROM_EMAIL||process.env.CONTACT_FROM_EMAIL||"Peptibra <onboarding@resend.dev>",to:[email],subject:"Tu acceso privado a Peptibra",
    html:`<div style="font-family:Arial,sans-serif;max-width:580px;margin:auto;color:#20252b"><div style="border-top:6px solid #ef003f;padding:28px"><img src="https://peptibra.com/brand/peptibra-logo-dark-1400.png" width="210" alt="Peptibra" style="display:block;height:auto;margin:0 0 24px"><h1 style="color:#ef003f">Acceso a Peptibra</h1><p>Hola <strong>${escapeHtml(name)}</strong>,</p><p>Se creó o restableció tu acceso personal a la oficina de Peptibra.</p><p><strong>Usuario:</strong> ${escapeHtml(email)}<br/><strong>Contraseña temporal:</strong> ${escapeHtml(password)}</p><p><a href="https://peptibra.com/login?next=%2Fptbr-mobile" style="display:inline-block;background:#ef003f;color:white;text-decoration:none;padding:12px 18px;border-radius:7px">Entrar a la oficina</a></p><p style="font-size:12px;color:#68717b">Al entrar por primera vez deberás cambiar la contraseña temporal.</p></div></div>`
  })});
  if(response.ok)return {sent:true,error:""};
  const detail=await response.json().catch(()=>({})) as {message?:string;error?:{message?:string}};
  return {sent:false,error:detail.message||detail.error?.message||`El servicio de correo respondió ${response.status}.`};
}

async function isAdmin(request:Request){
  const web=await getAuthorizedUser();
  if(web?.role==="admin")return true;
  const user=await userFromBearer(request);return user?.role==="admin";
}

export async function GET(request:Request){
  if(!await isAdmin(request))return Response.json({error:"Solo el administrador puede gestionar accesos"},{status:403});
  const db=service();
  const [{data:profiles,error},{data:team}]=await Promise.all([db.from("user_profiles").select("email,team_id,role,active,created_at,updated_at"),db.from("team").select("id,name,role,partner_id,active").eq("active",1)]);
  if(error)return Response.json({error:error.message},{status:500});
  return Response.json({profiles:profiles||[],team:team||[]});
}

export async function POST(request:Request){
  if(!await isAdmin(request))return Response.json({error:"Solo el administrador puede gestionar accesos"},{status:403});
  try{
    const body=await request.json(),action=String(body.action||""),email=String(body.email||"").trim().toLowerCase(),teamId=Number(body.teamId||0);
    if(!email||!/^\S+@\S+\.\S+$/.test(email))return Response.json({error:"Escribe un correo válido"},{status:400});
    const db=service();
    if(action==="disable"){await db.from("user_profiles").update({active:0,updated_at:new Date().toISOString()}).eq("email",email).neq("role","admin");await db.from("auth_users").update({active:0,updated_at:new Date().toISOString()}).eq("email",email).neq("role","admin");return Response.json({ok:true,message:"Acceso bloqueado"})}
    if(!teamId)return Response.json({error:"Selecciona un integrante del equipo"},{status:400});
    if(body.member){
      const member=body.member;
      const {error:syncError}=await db.from("team").upsert({id:teamId,name:String(member.name||""),phone:String(member.phone||""),role:String(member.role)==="Socio"?"Socio":"Vendedor",partner_id:Number(member.partnerId)||null,commission:Number(member.commission)||0,max_discount:Number(member.maxDiscount)||0,notes:String(member.notes||""),active:1,created_at:new Date().toISOString()},{onConflict:"id"});
      if(syncError)throw syncError;
    }
    const {data:member,error:memberError}=await db.from("team").select("id,name,role,active").eq("id",teamId).maybeSingle();
    if(memberError||!member||Number(member.active)!==1)return Response.json({error:"El integrante no está activo"},{status:400});
    const role=String(member.role).toLowerCase()==="socio"?"socio":"vendedor";
    const now=new Date().toISOString();
    const {error:profileError}=await db.from("user_profiles").upsert({email,team_id:teamId,role,active:1,updated_at:now},{onConflict:"email"});
    if(profileError)throw profileError;
    const temporary=`Ptbr-${randomBytes(8).toString("base64url")}!`,passwordHash=await hashPassword(temporary);
    const {error:accountError}=await db.from("auth_users").upsert({id:email,email,password_hash:passwordHash,role,team_id:teamId,active:1,must_change_password:1,created_at:now,updated_at:now},{onConflict:"email"});if(accountError)throw accountError;
    // Cada acceso recibe el catálogo común, pero comienza con un inventario
    // propio explícitamente inicializado en cero.
    const location=`VENDEDOR:${teamId}`,[{data:products,error:productsError},{data:balances,error:balancesError}]=await Promise.all([db.from("products").select("id").eq("status","active"),db.from("inventory_balances").select("product_id").eq("location",location)]);if(productsError)throw productsError;if(balancesError)throw balancesError;const existing=new Set((balances||[]).map((row:Row)=>Number(row.product_id))),missing=(products||[]).filter((product:Row)=>!existing.has(Number(product.id))).map((product:Row)=>({product_id:Number(product.id),location,quantity:0,updated_at:now}));if(missing.length){const {error:inventoryError}=await db.from("inventory_balances").upsert(missing,{onConflict:"product_id,location"});if(inventoryError)throw inventoryError}
    const delivery=await sendAccessEmail(email,String(member.name||"Integrante"),temporary);
    return Response.json({ok:true,emailSent:delivery.sent,temporaryPassword:temporary,
      message:delivery.sent?`Acceso de ${member.name} creado y enviado a ${email}.`:`Acceso de ${member.name} creado, pero el correo no pudo enviarse. ${delivery.error}`});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"No se pudo gestionar el acceso"},{status:500})}
}
