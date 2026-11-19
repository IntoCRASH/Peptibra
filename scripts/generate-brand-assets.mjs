import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const webRoot=path.resolve(import.meta.dirname,"..");
const repoRoot=path.resolve(webRoot,"..");
const source=path.join(repoRoot,"branding","impulso");
const target=path.join(webRoot,"public","brand");
await fs.mkdir(target,{recursive:true});
for(const file of ["peptibra-mark.svg","peptibra-logo-dark.svg","peptibra-logo-light.svg","peptibra-logo-stacked-dark.svg"]){
  await fs.copyFile(path.join(source,file),path.join(target,file));
}
const renders=[
  ["peptibra-mark.svg","peptibra-mark-1024.png",1024],
  ["peptibra-mark.svg","peptibra-mark-512.png",512],
  ["peptibra-mark.svg","peptibra-mark-256.png",256],
  ["peptibra-mark.svg","peptibra-mark-192.png",192],
  ["peptibra-mark.svg","peptibra-mark-180.png",180],
  ["peptibra-mark.svg","peptibra-mark-64.png",64],
  ["peptibra-mark.svg","peptibra-mark-32.png",32],
  ["peptibra-mark.svg","peptibra-mark-16.png",16],
  ["peptibra-logo-dark.svg","peptibra-logo-dark-1400.png",1400],
  ["peptibra-logo-light.svg","peptibra-logo-light-1400.png",1400],
  ["peptibra-logo-stacked-dark.svg","peptibra-logo-stacked-dark-1024.png",1024],
];
for(const [input,output,width] of renders){
  await sharp(path.join(source,input),{density:300}).resize({width}).png().toFile(path.join(target,output));
}
await fs.copyFile(path.join(target,"peptibra-mark-512.png"),path.join(webRoot,"app","icon.png"));
await fs.copyFile(path.join(target,"peptibra-mark-180.png"),path.join(webRoot,"app","apple-icon.png"));
// Keep legacy public URLs visually safe for installed PWAs and browser caches.
for(const legacySvg of ["favicon.svg","favicon-red-v3.svg","favicon-blue-v2.svg"]){
  await fs.copyFile(path.join(source,"peptibra-mark.svg"),path.join(webRoot,"public",legacySvg));
}
for(const [sourceName,legacyName] of [
  ["peptibra-mark-512.png","peptibra-isotipo.png"],
  ["peptibra-mark-512.png","favicon-isotipo.png"],
  ["peptibra-mark-180.png","apple-icon-red-v3.png"],
  ["peptibra-mark-180.png","apple-icon-blue-v2.png"],
  ["peptibra-mark-192.png","icons/peptibra-192.png"],
  ["peptibra-mark-512.png","icons/peptibra-512.png"],
  ["peptibra-mark-192.png","icons/peptibra-red-192-v3.png"],
  ["peptibra-mark-512.png","icons/peptibra-red-512-v3.png"],
  ["peptibra-mark-192.png","icons/peptibra-blue-192-v2.png"],
  ["peptibra-mark-512.png","icons/peptibra-blue-512-v2.png"],
  ["peptibra-logo-dark-1400.png","peptibra-logo-dark.png"],
  ["peptibra-logo-light-1400.png","peptibra-logo-original.png"],
]){
  await fs.copyFile(path.join(target,sourceName),path.join(webRoot,"public",legacyName));
}
const shareLogo=await sharp(path.join(source,"peptibra-logo-light.svg"),{density:300}).resize({width:760}).png().toBuffer();
await sharp({create:{width:1200,height:630,channels:4,background:"#111318"}})
  .composite([{input:shareLogo,left:220,top:190}]).png().toFile(path.join(target,"peptibra-share-1200x630.png"));
await fs.copyFile(path.join(target,"peptibra-share-1200x630.png"),path.join(webRoot,"public","og-red-v3.png"));
await fs.copyFile(path.join(target,"peptibra-share-1200x630.png"),path.join(webRoot,"public","og-blue-v2.png"));
console.log(`Generated ${renders.length} Peptibra Impulso assets in ${target}`);
