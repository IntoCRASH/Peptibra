"use client";
import Image from "next/image";
import { useMemo, useState } from "react";
import { products } from "../productData";

export default function ProductCatalog(){
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("Todos");
  const categories=["Todos",...Array.from(new Set(products.map(p=>p.category)))];
  const visible=useMemo(()=>products.filter(p=>{
    const matchesText=`${p.name} ${p.dose} ${p.category}`.toLowerCase().includes(query.toLowerCase().trim());
    return matchesText&&(category==="Todos"||p.category===category);
  }),[query,category]);
  return <>
    <div className="pb-catalog-controls">
      <label><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} type="search" placeholder="Buscar por producto, categoría o presentación..." aria-label="Buscar productos"/></label>
      <div>{categories.map(c=><button className={category===c?"active":""} onClick={()=>setCategory(c)} key={c}>{c}</button>)}</div>
    </div>
    <div className="pb-shop-tools"><span>{visible.length} {visible.length===1?"resultado":"resultados"}</span><span>Consulta de disponibilidad y documentación</span></div>
    {visible.length?<div className="pb-product-grid">{visible.map((p)=><article className="pb-product-card" key={p.slug}><div className="pb-product-image"><span>CATÁLOGO</span><Image src={p.image} width={1254} height={1254} alt={`Vial Peptibra ${p.name} ${p.dose}`} unoptimized/></div><div className="pb-product-body"><small>{p.category}</small><h2>{p.name}</h2><p>{p.dose} · Polvo liofilizado</p><div><span>Tapa {p.cap}</span><a href="mailto:info@peptibra.com">Solicitar información →</a></div></div></article>)}</div>:<div className="pb-empty">No encontramos productos que coincidan con tu búsqueda.</div>}
  </>;
}
