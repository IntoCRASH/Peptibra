import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await client.from("product_profiles").select("photo_key");
if (error) throw error;
fs.mkdirSync("cloudflare/images", { recursive: true });
for (const row of data || []) {
  const key = String(row.photo_key || ""); if (!key) continue;
  const { data: file, error: fileError } = await client.storage.from("product-images").download(key);
  if (fileError) throw fileError;
  const target = path.join("cloudflare/images", key.replaceAll("/", "__"));
  fs.writeFileSync(target, Buffer.from(await file.arrayBuffer()));
  console.log(`${key}\t${target}`);
}
