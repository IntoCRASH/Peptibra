/* eslint-disable @next/next/no-img-element -- The QR must render predictably in exported documents. */
"use client";
import Image from "next/image";
import {toJpeg} from "html-to-image";
import {useState} from "react";

const encoder=new TextEncoder();
const ascii=(value:string)=>encoder.encode(value);
const joinBytes=(parts:Uint8Array[])=>{const size=parts.reduce((sum,part)=>sum+part.length,0),result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length}return result};
const dataUrlBytes=(dataUrl:string)=>{const binary=atob(dataUrl.split(",")[1]||"");const bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);return bytes};
const jpegSize=(dataUrl:string)=>new Promise<{width:number;height:number}>((resolve,reject)=>{const image=new window.Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(new Error("No se pudo preparar una página del PDF"));image.src=dataUrl});

async function prepareNode(node:HTMLElement){
 if(document.fonts?.ready)await document.fonts.ready;
 const images=[...node.querySelectorAll("img")] as HTMLImageElement[];
 await Promise.all(images.map(image=>image.complete?(image.decode?.().catch(()=>undefined)??Promise.resolve()):new Promise<void>(resolve=>{image.addEventListener("load",()=>resolve(),{once:true});image.addEventListener("error",()=>resolve(),{once:true})})));
}
async function withFixedA4<T>(task:()=>Promise<T>){
 document.documentElement.classList.add("pdf-capture-mode");
 try{
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  return await task();
 }finally{document.documentElement.classList.remove("pdf-capture-mode")}
}
async function capturePage(node:HTMLElement){
 await prepareNode(node);
 const rect=node.getBoundingClientRect(),width=Math.ceil(rect.width),height=Math.ceil(Math.max(rect.height,node.scrollHeight));
 if(width<=0||height<=0)throw new Error("El documento no tiene un tamaño válido para exportar");
 return toJpeg(node,{quality:.95,pixelRatio:1.55,width,height,backgroundColor:"#ffffff",cacheBust:true,style:{margin:"0",marginLeft:"0",marginRight:"0",left:"0",right:"auto",transform:"none"}});
}
async function buildPdf(nodes:HTMLElement[]){
 const pages=[] as {jpeg:Uint8Array;width:number;height:number}[];
 for(const node of nodes){const dataUrl=await capturePage(node),size=await jpegSize(dataUrl);pages.push({jpeg:dataUrlBytes(dataUrl),...size})}
 if(!pages.length)throw new Error("No se encontró el documento imprimible");
 const parts:Uint8Array[]=[ascii("%PDF-1.4\n%Peptibra\n")],offsets:number[]=[0];let length=parts[0].length;
 const add=(objectNumber:number,...body:Uint8Array[])=>{offsets[objectNumber]=length;const block=[ascii(`${objectNumber} 0 obj\n`),...body,ascii("\nendobj\n")];parts.push(...block);length+=block.reduce((sum,item)=>sum+item.length,0)};
 add(1,ascii("<< /Type /Catalog /Pages 2 0 R >>"));
 const kids=pages.map((_,index)=>`${3+index*3} 0 R`).join(" ");add(2,ascii(`<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`));
 pages.forEach((page,index)=>{const pageId=3+index*3,imageId=pageId+1,contentId=pageId+2,commands=ascii("q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n");add(pageId,ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));add(imageId,ascii(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`),page.jpeg,ascii("\nendstream"));add(contentId,ascii(`<< /Length ${commands.length} >>\nstream\n`),commands,ascii("endstream"))});
 const xref=length,count=3+pages.length*3;let table=`xref\n0 ${count}\n0000000000 65535 f \n`;for(let id=1;id<count;id++)table+=`${String(offsets[id]).padStart(10,"0")} 00000 n \n`;const tail=ascii(`${table}trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);parts.push(tail);return new Blob([joinBytes(parts)],{type:"application/pdf"})
}

export const DISCLAIMER = "IMPORTANTE: PEPTIBRA Peptide Depot™ es un hub digital independiente que canaliza el acceso a péptidos y compuestos para fines de investigación, cuidadosamente seleccionados y con COAs verificables. No somos fabricantes ni laboratorio clínico o farmacéutico. Todo nuestro catálogo y la información disponibles están orientados exclusivamente al ámbito de la investigación. Estos productos no están destinados a diagnosticar, tratar, curar ni prevenir ninguna enfermedad. Todos los productos se venden exclusivamente para fines de investigación, laboratorio o análisis, y están destinados a su uso en investigaciones de laboratorio controladas. La información proporcionada tiene fines estrictamente informativos.";
export function PrintToolbar({title,captureSelector=".canonical-sheet"}:{title:string;captureSelector?:string}){
 const [busyAction,setBusyAction]=useState(""),busy=Boolean(busyAction),filename=`${title.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"")||"documento-peptibra"}.pdf`;
 const clickDownload=(url:string,name:string,revoke=false)=>{const link=document.createElement("a");link.href=url;link.download=name;link.style.display="none";document.body.appendChild(link);link.click();window.setTimeout(()=>{link.remove();if(revoke)URL.revokeObjectURL(url)},30000)};
 const makeJpeg=async()=>withFixedA4(async()=>{const node=document.querySelector(captureSelector) as HTMLElement|null;if(!node)throw new Error("No se encontró el documento imprimible");return capturePage(node)});
 const saveJpeg=async()=>{const url=await makeJpeg();clickDownload(url,`${title.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"")||"documento-peptibra"}.jpg`)};
 const makePdf=()=>withFixedA4(()=>buildPdf([...document.querySelectorAll(captureSelector)] as HTMLElement[]));
 const downloadPdf=async(blob?:Blob)=>{const pdf=blob||await makePdf(),url=URL.createObjectURL(pdf);clickDownload(url,filename,true)};
 const run=async(action:string,task:()=>Promise<void>)=>{setBusyAction(action);try{await task()}catch(error){alert(error instanceof Error?error.message:"No se pudo generar el documento")}finally{setBusyAction("")}};
 const whatsapp=async()=>{setBusyAction("whatsapp");try{const blob=await makePdf(),file=new File([blob],filename,{type:"application/pdf"}),shareData={title,text:`Documento Peptibra: ${title}`,files:[file]};if(navigator.share&&(!navigator.canShare||navigator.canShare(shareData))){await navigator.share(shareData);return}await downloadPdf(blob);window.open(`https://wa.me/?text=${encodeURIComponent(`Documento Peptibra: ${title}`)}`,"_blank","noopener,noreferrer");alert("El PDF fue descargado. WhatsApp se abrirá para que selecciones el contacto y adjuntes el archivo.")}catch(error){if(error instanceof DOMException&&error.name==="AbortError")return;alert(error instanceof Error?error.message:"No se pudo compartir el documento")}finally{setBusyAction("")}};
 const goBack=()=>{if(window.history.length>1)window.history.back();else window.location.assign("/office")};
 return <div className="print-toolbar"><button className="back" onClick={goBack}>← Volver</button><button onClick={()=>window.print()}>Imprimir</button><button disabled={busy} onClick={()=>run("pdf",()=>downloadPdf())}>{busyAction==="pdf"?"Preparando PDF…":"Guardar PDF"}</button><button disabled={busy} onClick={()=>run("jpg",saveJpeg)}>{busyAction==="jpg"?"Preparando JPG…":"Guardar JPG"}</button><button className="whatsapp-share" disabled={busy} onClick={whatsapp}>{busyAction==="whatsapp"?"Preparando…":"Enviar PDF por WhatsApp"}</button></div>
}
export function CorporateHeader({kicker,title,detail}:{kicker:string;title:string;detail?:string}){return <><div className="corporate-logo"><Image src="/brand/peptibra-logo-dark.svg" width={980} height={270} alt="Peptibra" unoptimized priority/></div><div className="corporate-rule"/><p className="corporate-disclaimer">{DISCLAIMER}</p><div className="corporate-title"><div><small>{kicker.toUpperCase()}</small><h1>{title}</h1></div>{detail&&<strong>{detail}</strong>}</div><div className="corporate-accent"/></>}
export function CorporateFooter({left}:{left:string}){return <footer className="corporate-footer"><span>{left}</span><div><b>peptibra.com</b><img src="/peptibra-qr.png" alt="Código QR de Peptibra"/></div></footer>}
