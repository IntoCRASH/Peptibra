"use client";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { products } from "../productData";

export default function ProductCatalog(){
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("Todos");
  const [availability,setAvailability]=useState("Todos");
  const [sort,setSort]=useState("featured");
  const categories=["Todos",...Array.from(new Set(products.map(p=>p.category)))];
  const visible=useMemo(()=>{
    const filtered=products.filter(p=>{
      const term=query.toLowerCase().trim();
      const matchesText=`${p.name} ${p.dose} ${p.category} ${p.format}`.toLowerCase().includes(term);
      const matchesCategory=category==="Todos"||p.category===category;
      const matchesAvailability=availability==="Todos"||p.status===availability;
      return matchesText&&matchesCategory&&matchesAvailability;
    });
    return [...filtered].sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="dose"?parseInt(a.dose)-parseInt(b.dose):0);
  },[query,category,availability,sort]);
  const reset=()=>{setQuery("");setCategory("Todos");setAvailability("Todos");setSort("featured")};
  return <>
    <div className="pb-catalog-panel">
      <label className="pb-catalog-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} type="search" placeholder="Buscar producto, categoría o presentación..." aria-label="Buscar productos"/></label>
      <div className="pb-catalog-selects">
        <label>Disponibilidad<select value={availability} onChange={e=>setAvailability(e.target.value)}><option>Todos</option><option>Disponible</option><option>Disponibilidad limitada</option></select></label>
        <label>Ordenar<select value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Selección Peptibra</option><option value="name">Nombre A–Z</option><option value="dose">Presentación</option></select></label>
      </div>
      <div className="pb-category-tabs" aria-label="Filtrar por categoría">{categories.map(c=><button type="button" className={category===c?"active":""} onClick={()=>setCategory(c)} key={c}>{c}</button>)}</div>
    </div>
    <div className="pb-shop-tools"><span><b>{visible.length}</b> {visible.length===1?"producto":"productos"}</span><button type="button" onClick={reset}>Restablecer filtros</button></div>
    {visible.length?<div className="pb-product-grid">{visible.map((p)=><article className="pb-product-card" key={p.slug}>
      <Link className="pb-product-image" href={`/products/${p.slug}`} aria-label={`Ver ficha de ${p.name}`}><span>{p.status}</span><Image src={p.image} width={1254} height={1254} alt={`Vial Peptibra ${p.name} ${p.dose}`} unoptimized/></Link>
      <div className="pb-product-body"><small>{p.category}</small><h2><Link href={`/products/${p.slug}`}>{p.name}</Link></h2><p>{p.dose} · {p.format}</p><div className="pb-card-meta"><span className={p.coaStatus.includes("disponible")?"ready":"review"}>{p.coaStatus}</span><span>Tapa {p.cap}</span></div><div className="pb-card-actions"><Link href={`/products/${p.slug}`}>Ver ficha →</Link><a href={`mailto:peptibra@gmail.com?subject=${encodeURIComponent(`Consulta sobre ${p.name} ${p.dose}`)}`}>Consultar</a></div></div>
    </article>)}</div>:<div className="pb-empty"><b>No encontramos coincidencias.</b><span>Prueba otra búsqueda o restablece los filtros.</span><button type="button" onClick={reset}>Ver todo el catálogo</button></div>}
  </>;
}
