import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "../../SiteHeader";
import VerificationGate from "../../VerificationGate";
import { getProduct, products } from "../../productData";

export function generateStaticParams(){return products.map(product=>({slug:product.slug}))}

export default async function ProductPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const product=getProduct(slug);
  if(!product) notFound();
  const subject=encodeURIComponent(`Consulta sobre ${product.name} ${product.dose}`);
  return <main className="pb-site"><VerificationGate/><SiteHeader/>
    <nav className="pb-product-breadcrumb" aria-label="Ruta de navegación"><Link href="/">Inicio</Link><span>/</span><Link href="/products">Catálogo</Link><span>/</span><b>{product.name}</b></nav>
    <section className="pb-product-detail">
      <div className="pb-product-detail-image"><span>{product.status}</span><Image src={product.image} width={1254} height={1254} alt={`Vial Peptibra ${product.name} ${product.dose}`} unoptimized priority/></div>
      <div className="pb-product-detail-copy"><span className="pb-kicker">{product.category}</span><h1>{product.name}</h1><p className="pb-product-lead">{product.summary}</p>
        <dl><div><dt>Presentación</dt><dd>{product.dose}</dd></div><div><dt>Formato</dt><dd>{product.format}</dd></div><div><dt>Identificación</dt><dd>Tapa {product.cap}</dd></div><div><dt>Documentación</dt><dd>{product.coaStatus}</dd></div></dl>
        <div className="pb-product-ctas"><a className="pb-btn primary" href={`mailto:peptibra@gmail.com?subject=${subject}`}>Solicitar información →</a><Link className="pb-btn secondary" href="/faq">Cómo interpretar los COAs</Link></div>
        <small className="pb-research-notice">Exclusivamente para investigación in vitro y uso controlado de laboratorio. No apto para consumo humano o veterinario.</small>
      </div>
    </section>
    <section className="pb-product-info-grid"><article><span className="pb-kicker">ÁREAS DE CONSULTA</span><h2>Contexto de investigación</h2><ul>{product.researchFocus.map(item=><li key={item}>{item}</li>)}</ul></article><article><span className="pb-kicker">TRAZABILIDAD</span><h2>Documentación por lote</h2><p>Peptibra organiza la evidencia disponible junto al producto que representa. Solicita el lote vigente para consultar su documentación específica.</p><a href={`mailto:peptibra@gmail.com?subject=${subject}`}>Consultar lote vigente →</a></article></section>
    <section className="pb-product-back"><Link href="/products">← Volver al catálogo completo</Link></section>
    <footer><Image src="/peptibra-logo-dark.png" width={1774} height={887} alt="Peptibra" unoptimized/><p>Catálogo informativo para fines de investigación.</p><a href="mailto:peptibra@gmail.com">peptibra@gmail.com</a></footer>
  </main>
}
