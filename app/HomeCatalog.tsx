"use client";
import Image from "next/image";
import {useEffect,useMemo,useState} from "react";
import {useLanguage} from "./LanguageProvider";
import {products as editorial} from "./productData";

type Item={id:number;name:string;concentration:string;price:number;stock:number;photoKey?:string;category?:string};
const unavailable="/product-image-unavailable.png";
const categoriesEn:Record<string,string>={"Péptido":"Peptide","Accesorio":"Accessory","Agua bacteriostática":"Bacteriostatic water"};
const categoryEn=(value:string)=>categoriesEn[value]||value;
const presentationEn=(value:string)=>value.replace(/\bviales?\b/gi,"vials");
const aliases:Record<string,string>={"Dual Receptor Agonist":"tirzepatide","Triple Receptor Agonist":"glp3-reta"};
const historicalPhoto=(name:string)=>editorial.find(p=>p.slug===(aliases[name]||"")||p.name.toLowerCase()===name.toLowerCase())?.image||unavailable;

export default function HomeCatalog(){
 const {locale}=useLanguage(),es=locale==="es",[items,setItems]=useState<Item[]>([]);
 useEffect(()=>{fetch("/api/catalog").then(r=>r.json()).then(j=>setItems(j.products||[])).catch(()=>{})},[]);
 const families=useMemo(()=>{const map=new Map<string,Item[]>();for(const item of items)map.set(item.name,[...(map.get(item.name)||[]),item]);return [...map.entries()].slice(0,5)},[items]);
 return <div className="pb-mini-grid">{families.map(([name,variants])=>{const photo=variants.find(v=>v.photoKey)?.photoKey,fallback=historicalPhoto(name),available=variants.some(v=>v.stock>0),category=variants[0].category||"Peptibra";return <article key={name}><div><Image src={photo?`/api/catalog/image?key=${encodeURIComponent(photo)}`:fallback} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=fallback}} width={1254} height={1254} alt={`${es?"Producto":"Product"} ${name}`} unoptimized/></div><span>{es?category:categoryEn(category)}</span><h3>{name}</h3><p>{variants.map(v=>es?v.concentration:presentationEn(v.concentration)).join(" · ")}</p><small className={available?"available":"sold-out"}>{available?(es?"Disponible":"Available"):(es?"Agotado":"Sold out")}</small></article>})}</div>
}
