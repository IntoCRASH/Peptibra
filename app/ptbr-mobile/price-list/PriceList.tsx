"use client";

import { useEffect, useMemo, useState } from "react";
import "./price-list.css";
import { CorporateFooter, CorporateHeader, PrintToolbar } from "../print-shared";

type Row = Record<string, unknown>;
const money = (value: unknown) => `US$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const mgOf = (value: unknown) => Number(String(value || "").match(/(?:^|\D)(5|10|15|20|30|40|50|100)\s*mg\b/i)?.[1] || 0);

export default function PriceList() {
  const [products, setProducts] = useState<Row[]>([]);
  useEffect(() => { fetch("/api/mobile").then(response => response.json()).then(data => setProducts(data.products || [])); }, []);
  const families = useMemo(() => {
    const grouped = new Map<string, { name: string; description: string; photo: string; prices: { mg: number; label: string; price: number }[] }>();
    for (const product of products) {
      const key = String(product.name || "").trim().toLowerCase();
      const family = grouped.get(key) || { name: String(product.name || ""), description: "", photo: "", prices: [] };
      family.description ||= String(product.description || "");
      family.photo ||= String(product.photo_key || "");
      const price = Number(product.normal_price || product.price || 0), mg = mgOf(product.concentration);
      if (price > 0) family.prices.push({ mg, label: mg ? `${mg} mg` : String(product.concentration || "Presentación"), price });
      grouped.set(key, family);
    }
    return [...grouped.values()].map(family => ({ ...family, prices: family.prices.sort((a, b) => (a.mg || 9999) - (b.mg || 9999)) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);
  const base = process.env.NEXT_PUBLIC_PEPTIBRA_FILES_URL || "https://peptibra-api.peptibra-management.workers.dev/files";
  return <main className="print-document">
    <PrintToolbar title="Lista de precios Peptibra"/>
    <article className="canonical-sheet price-sheet">
      <CorporateHeader kicker="" title="LISTA DE PRECIOS" detail={`Actualizada: ${new Date().toLocaleDateString("es-DO")}`}/>
      <section className="price-grid">{families.map(family => <article key={family.name}>{family.photo ? <img src={`${base}/${encodeURIComponent(family.photo)}`} alt=""/> : <i>{family.name.slice(0, 2)}</i>}<div><b>{family.name}</b><p>{family.description || "Sin descripción disponible."}</p><span>Presentaciones disponibles</span><small className="available-presentations">{family.prices.map(price => price.label).join(", ")}</small><span>Precios por mg disponibles.</span><div className="family-price-list">{family.prices.map(price => <strong key={price.label}><span>{price.label}</span>{money(price.price)}</strong>)}</div></div></article>)}</section>
      <CorporateFooter left="PEPTIBRA - Página 1 de 1"/>
    </article>
  </main>;
}
