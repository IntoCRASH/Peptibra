import Image from "next/image";
import Link from "next/link";
import SiteHeader from "../SiteHeader";
import VerificationGate from "../VerificationGate";
import { products } from "../productData";

const publishedCoas: Record<string, { product: string; purity: string; lot: string; reported: string; href: string }> = {
  tirzepatide: { product: "Tirzepatide", purity: "99.53%", lot: "063026", reported: "29 oct 2026", href: "/coas/tirzepatide-20mg-lot-063026.pdf" },
  "glp3-reta": { product: "Retatrutide", purity: "99.94%", lot: "082026", reported: "29 oct 2026", href: "/coas/retatrutide-20mg-lot-082026.pdf" },
};

export default function CoasPage() {
  return <main className="pb-site pb-public-new">
    <VerificationGate/><SiteHeader/>
    <section className="new-page-head coa-head"><div><span>DOCUMENTACIÓN POR LOTE</span><h1>Centro de COAs</h1><p>Consulta los reportes analíticos disponibles y verifica pureza, identidad, lote y laboratorio emisor.</p></div><Image src="/editorial/peptibra-glp3-bac-dark.png" width={1536} height={1024} alt="Viales Peptibra en laboratorio" priority/></section>
    <section className="coa-featured" aria-labelledby="coa-featured-title"><header><span>REPORTES RECIENTES</span><h2 id="coa-featured-title">Pureza verificada por lote</h2><p>Identidad confirmada mediante LC-MS y pureza determinada mediante HPLC-UV.</p></header><div>{Object.values(publishedCoas).map(coa=><article key={coa.product}><small>IDENTIDAD CONFIRMADA</small><h3>{coa.product}</h3><p>20 mg · Lote {coa.lot} · Reportado {coa.reported}</p><div className="coa-purity"><span>PUREZA</span><strong>{coa.purity}</strong></div><a href={coa.href} target="_blank" rel="noreferrer">Abrir COA →</a></article>)}</div></section>
    <section className="new-coa-list">{products.map((product,index)=>{const coa=publishedCoas[product.slug];const available=Boolean(coa)||product.coaStatus==="Documentación disponible";const subject=encodeURIComponent(`Solicitud de COA · ${product.name}`);return <article key={product.slug}><b>{String(index+1).padStart(2,"0")}</b><div><small>{product.category}</small><h2>{coa?.product||product.name}</h2><p>{product.dose} · {product.format}{coa?` · Lote ${coa.lot}`:""}</p></div><span className={available?"ready":"review"}>{available?"Disponible":"En revisión"}</span>{coa?<strong className="coa-list-purity"><small>PUREZA</small>{coa.purity}</strong>:<span/>}{coa?<a href={coa.href} target="_blank" rel="noreferrer">Abrir COA →</a>:<a href={`mailto:peptibra@gmail.com?subject=${subject}`}>Solicitar COA →</a>}</article>})}</section>
    <section className="new-coa-note"><h2>Cómo verificar un reporte</h2><p>Compara producto, presentación, número de lote, fecha del análisis y laboratorio emisor. El documento siempre debe corresponder al lote consultado.</p><Link href="/faq">Cómo interpretar los COAs →</Link></section>
  </main>;
}
