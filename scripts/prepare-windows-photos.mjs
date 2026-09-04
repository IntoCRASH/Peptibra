import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
const db=new DatabaseSync("C:/PepCalculo/peptibra.db"),rows=db.prepare("SELECT id,foto FROM productos WHERE activo=1 AND foto<>'' ORDER BY id").all(),uploads=new Map(),sql=[];
for(const row of rows){if(!fs.existsSync(row.foto))continue;const key=`windows-${path.basename(row.foto)}`;uploads.set(key,row.foto);sql.push(`UPDATE product_profiles SET photo_key='${key.replaceAll("'","''")}' WHERE product_id=${Number(row.id)};`);}
fs.writeFileSync("tmp/windows-photos.json",JSON.stringify([...uploads].map(([key,file])=>({key,file})),null,2),"utf8");
fs.writeFileSync("tmp/windows-photo-map.sql",sql.join("\n")+"\n","utf8");
console.log({products:sql.length,uniquePhotos:uploads.size});
