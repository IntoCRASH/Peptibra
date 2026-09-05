const fallback="Research product available in the listed presentations.";
export async function POST(request:Request){
 try{
  const body=await request.json() as {texts?:unknown},texts=Array.isArray(body.texts)?body.texts.filter((v):v is string=>typeof v==="string"&&v.trim().length>0&&v.length<=1200).slice(0,24):[];
  const entries=await Promise.all(texts.map(async text=>{try{const url=`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=es%7Cen`,response=await fetch(url,{next:{revalidate:86400}});if(!response.ok)throw new Error("translation failed");const data=await response.json(),translated=String(data?.responseData?.translatedText||"").trim();return[text,translated||fallback]}catch{return[text,fallback]}}));
  return Response.json({translations:Object.fromEntries(entries)});
 }catch{return Response.json({translations:{}})}
}
