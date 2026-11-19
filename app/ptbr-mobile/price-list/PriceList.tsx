/* eslint-disable @next/next/no-img-element -- Product photos must preserve their print layout. */
"use client";

import { useEffect, useMemo, useState } from "react";
import "./price-list.css";
import { CorporateFooter, CorporateHeader, PrintToolbar } from "../print-shared";

type Row = Record<string, unknown>;
const money = (value: unknown) => `US$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const mgOf = (value: unknown) => Number(String(value || "").match(/(?:^|\D)(5|10|15|20|30|40|50|100)\s*mg\b/i)?.[1] || 0);

export default function PriceList() {
  const [products, setProducts] = useState<Row[]>([]);
  const [productSales, setProductSales] = useState<Record<string, number>>({});
  useEffect(() => { fetch("/api/mobile").then(response => response.json()).then(data => { setProducts(data.products || []); setProductSales(data.productSales || {}); }); }, []);
  const families = useMemo(() => {
    const grouped = new Map<string, { name: string; description: string; photo: string; unitsSold: number; prices: { mg: number; label: string; price: number }[] }>();
    for (const product of products) {
      const key = String(product.name || "").trim().toLowerCase();
      const family = grouped.get(key) || { name: String(product.name || ""), description: "", photo: "", unitsSold: 0, prices: [] };
      family.description ||= String(product.description || "");
      family.photo ||= String(product.photo_key || "");
      family.unitsSold += Number(productSales[String(product.id)] || 0);
      const price = Number(product.normal_price || product.price || 0), mg = mgOf(product.concentration);
      if (price > 0) family.prices.push({ mg, label: mg ? `${mg} mg` : String(product.concentration || "Presentación"), price });
      grouped.set(key, family);
    }
    return [...grouped.values()].map(family => ({ ...family, prices: family.prices.sort((a, b) => (a.mg || 9999) - (b.mg || 9999)) })).sort((a, b) => b.unitsSold - a.unitsSold || a.name.localeCompare(b.name, "es"));
  }, [products, productSales]);
  const pages = useMemo(() => {
    const result: typeof families[] = [];
    for (let index = 0; index < families.length; index += 9) result.push(families.slice(index, index + 9));
    return result.length ? result : [[]];
  }, [families]);
  return <main className="print-document">
    <PrintToolbar title="Lista de precios Peptibra"/>
    {pages.map((page, pageIndex) => {const lastPage=pageIndex===pages.length-1;return <article className={`canonical-sheet price-sheet ${lastPage?"has-loyalty":""}`} key={pageIndex}>
      <CorporateHeader kicker="CATÁLOGO DE INVESTIGACIÓN" title="LISTA DE PRECIOS" detail={`Actualizada: ${new Date().toLocaleDateString("es-DO")}`}/>
      <div className="price-list-intro"><span>PEPTIBRA · PEPTIDE DEPOT</span><p>Presentaciones y precios vigentes, ordenados automáticamente por demanda.</p></div>
      <section className="price-grid">{page.map(family => <article key={family.name}>{family.photo ? <img src={`/api/catalog/image?key=${encodeURIComponent(family.photo)}`} alt=""/> : <i>{family.name.slice(0, 2)}</i>}<div><b>{family.name}</b><p>{family.description || "Producto de investigación disponible en las presentaciones indicadas."}</p><small className="available-presentations">{family.prices.map(price => price.label).join(" · ")}</small><div className="family-price-list">{family.prices.map(price => <strong key={price.label}><span>{price.label}</span>{money(price.price)}</strong>)}</div></div></article>)}</section>
      {lastPage&&<><section className="price-coa"><img src="/coas-qr.png" alt="Código QR del Centro de COAs de Peptibra"/><div><small>CALIDAD Y TRAZABILIDAD</small><h2>Documentación analítica por producto y lote.</h2><p>Seleccionamos productos con criterios de calidad y organizamos los Certificados de Análisis disponibles para que puedas consultar pureza, identidad y trazabilidad del lote.</p></div><a href="https://www.peptibra.com/coas">Escanea para consultar<br/><b>peptibra.com/coas</b></a></section><section className="price-loyalty"><div><small>PROGRAMA DE LEALTAD</small><h2>Tu confianza acumula beneficios.</h2><p>El nivel alcanzado nunca se reinicia. Por cada 10 clientes referidos se obtiene un producto gratis.</p></div><ol><li><b>1.ª y 2.ª compra</b><span>Precio regular</span></li><li><b>3.ª compra</b><span>5% de descuento</span></li><li><b>7.ª compra</b><span>15% de descuento</span></li><li><b>Desde la 10.ª</b><span>20% permanente</span></li></ol></section></>}
      <CorporateFooter left={`PEPTIBRA · Lista de precios · Página ${pageIndex + 1} de ${pages.length}`}/>
    </article>})}
  </main>;
}
