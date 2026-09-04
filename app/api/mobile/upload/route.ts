import { getAuthorizedUser } from "@/app/chatgpt-auth";
import { cloudDb } from "@/lib/cloudflare/supabase-compat";

export async function POST(request: Request) {
  const user = await getAuthorizedUser();
  if (!user || user.role !== "admin") return Response.json({ error: "Operación reservada para administración" }, { status: 403 });
  try {
    const form = await request.formData(), file = form.get("file"), productId = Number(form.get("productId"));
    if (!(file instanceof File) || !productId) return Response.json({ error: "Falta la imagen o el producto" }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return Response.json({ error: "La imagen no puede superar 8 MB" }, { status: 400 });
    if (!file.type.startsWith("image/")) return Response.json({ error: "Selecciona un archivo de imagen" }, { status: 400 });
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase(), key = `product-${productId}-${Date.now()}.${ext}`;
    const cloud = cloudDb;
    const { data: old } = await cloud.from("product_profiles").select("photo_key").eq("product_id", productId).maybeSingle();
    const base=process.env.PEPTIBRA_API_URL!,secret=process.env.PEPTIBRA_API_SECRET!;
    const upload=await fetch(`${base}/files/${encodeURIComponent(key)}`,{method:"PUT",headers:{"content-type":file.type,"x-peptibra-key":secret},body:await file.arrayBuffer()});
    if(!upload.ok)throw new Error((await upload.json() as {error?:string}).error||"No se pudo subir la imagen");
    const { error: updateError } = await cloud.from("product_profiles").update({ photo_key: key }).eq("product_id", productId);
    if (updateError) throw updateError;
    if (old?.photo_key) await fetch(`${base}/files/${encodeURIComponent(String(old.photo_key))}`,{method:"DELETE",headers:{"x-peptibra-key":secret}});
    return Response.json({ ok: true, key });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo subir la imagen" }, { status: 500 });
  }
}
