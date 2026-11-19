/* eslint-disable @typescript-eslint/ban-ts-comment -- User-managed product records are validated at runtime. */
// @ts-nocheck -- Dynamic upload adapter for user-managed product records.
import { getAuthorizedUser } from "@/app/chatgpt-auth";
import { cloudDb } from "@/lib/cloudflare/supabase-compat";
import { createHash } from "node:crypto";

export async function POST(request: Request) {
  const user = await getAuthorizedUser();
  if (!user || user.role !== "admin") return Response.json({ error: "Operación reservada para administración" }, { status: 403 });
  try {
    const form = await request.formData(), file = form.get("file"), productId = Number(form.get("productId"));
    if (!(file instanceof File) || !productId) return Response.json({ error: "Falta la imagen o el producto" }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return Response.json({ error: "La imagen no puede superar 8 MB" }, { status: 400 });
    if (!file.type.startsWith("image/")) return Response.json({ error: "Selecciona un archivo de imagen" }, { status: 400 });
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase(), bytes=Buffer.from(await file.arrayBuffer());
    const digest=createHash("sha256").update(bytes).digest("hex").slice(0,16),key = `product-${productId}-${digest}.${ext}`;
    const cloud = cloudDb;
    const {data:source,error:sourceError}=await cloud.from("products").select("name").eq("id",productId).maybeSingle();if(sourceError)throw sourceError;
    const {data:family,error:familyError}=await cloud.from("products").select("id").eq("name",source?.name||"");if(familyError)throw familyError;
    const familyIds=(family||[]).map(row=>Number(row.id));
    const { data: oldProfiles } = familyIds.length?await cloud.from("product_profiles").select("photo_key").in("product_id",familyIds):{data:[]};
    const base=process.env.PEPTIBRA_API_URL!,secret=process.env.PEPTIBRA_API_SECRET!;
    const upload=await fetch(`${base}/files/${encodeURIComponent(key)}`,{method:"PUT",headers:{"content-type":file.type,"x-peptibra-key":secret},body:bytes});
    if(!upload.ok)throw new Error((await upload.json() as {error?:string}).error||"No se pudo subir la imagen");
    const now = new Date().toISOString();
    const { error: updateError } = await cloud.from("product_profiles").update({ photo_key: key }).in("product_id",familyIds.length?familyIds:[productId]);
    if (updateError) throw updateError;
    const { error: revisionError } = await cloud.from("app_settings").upsert({ key: "mobile_data_revision", value: now, updated_at: now }, { onConflict: "key" });
    if (revisionError) throw revisionError;
    for(const old of new Set((oldProfiles||[]).map(row=>String(row.photo_key||"")).filter(old=>old&&old!==key))){await fetch(`${base}/files/${encodeURIComponent(old)}`,{method:"DELETE",headers:{"x-peptibra-key":secret}}).catch(()=>undefined)}
    return Response.json({ ok: true, key, revision: now });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo subir la imagen" }, { status: 500 });
  }
}
// @ts-nocheck -- Dynamic upload adapter for user-managed product records.
