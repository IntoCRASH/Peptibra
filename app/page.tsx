import Image from "next/image";
import Link from "next/link";
import VerificationGate from "./VerificationGate";
import SiteHeader from "./SiteHeader";
import { products } from "./productData";

export default function Home() {
  return <main className="pb-site"><VerificationGate/><SiteHeader/>
    <section className="pb-hero">
      <div className="pb-hero-copy">
        <span className="pb-pill"><i/> EL LOTE COMO PUNTO DE PARTIDA</span>
        <h1>Un hub especializado<br/><span>en péptidos de investigación.</span></h1>
        <p>Descubre una selección respaldada por información de lote, documentación analítica y una visión clara de la disponibilidad.</p>
        <div className="pb-actions"><Link className="pb-btn primary" href="/products">Explorar catálogo →</Link><a className="pb-btn secondary" href="#reportes">Consultar COAs</a></div>
        <p className="pb-helper">Conoce <a href="#modelo">cómo funciona nuestro modelo</a> o revisa las <Link href="/faq">preguntas frecuentes</Link>.</p>
      </div>
      <aside className="pb-verification" id="reportes">
        <div className="pb-card-head"><span className="pb-flask">⌬</span><div><b>Última verificación de lote</b><small>LOTE PB2601 · ANÁLISIS INDEPENDIENTE</small></div></div>
        <div className="pb-stats"><div><strong>99.2%</strong><span>PUREZA HPLC</span></div><div><strong>5</strong><span>PRODUCTOS INICIALES</span></div></div>
        <ul><li>Identidad confirmada mediante espectrometría de masas</li><li>Sin sustancias no declaradas en los lotes analizados</li><li>Reportes publicados y vinculados al inventario</li></ul>
        <div className="pb-verified">● Verificación independiente · sin vínculos financieros</div>
      </aside>
    </section>

    <section className="pb-lineup">
      <Image src="/products/peptibra-five-vials-editorial-v2.png" width={1086} height={1448} alt="Colección principal de viales Peptibra en estudio editorial" unoptimized/>
      <div><span className="pb-kicker">SELECCIÓN PEPTIBRA</span><h2>Cada lote cuenta<br/>una historia verificable.</h2><p>Presentación, disponibilidad y respaldo analítico conviven en una misma experiencia para que la información importante siempre esté al alcance.</p><Link className="pb-btn primary" href="/products">Explorar catálogo →</Link></div>
    </section>

    <section className="pb-featured" id="modelo"><div className="pb-section-title"><div><span className="pb-kicker">CATÁLOGO PEPTIBRA</span><h2>Información para decidir con criterio.</h2></div><Link href="/products">Abrir catálogo →</Link></div>
      <div className="pb-mini-grid">{products.slice(0,5).map(p=><article key={p.slug}><div><Image src={p.image} width={1254} height={1254} alt={`Vial ${p.name}`} unoptimized/></div><span>{p.category}</span><h3>{p.name}</h3><p>{p.dose} · Polvo liofilizado</p></article>)}</div>
    </section>

    <section className="pb-proof"><article><b>01</b><h3>Selección curada</h3><p>Una red de fuentes evaluadas amplía la disponibilidad sin perder consistencia.</p></article><article><b>02</b><h3>Documentación asociada</h3><p>La evidencia analítica acompaña al producto y al lote que representa.</p></article><article><b>03</b><h3>Actualización continua</h3><p>La información evoluciona junto con el inventario y sus nuevos reportes.</p></article></section>

    <section className="pb-coming-soon"><span className="pb-kicker">PEPTIBRA EVOLUCIONA</span><h2>Una experiencia cada vez más completa.</h2><p>Estamos preparando una forma segura y transparente de adquirir productos directamente desde Peptibra, con disponibilidad actualizada y documentación vinculada a cada lote.</p><Link className="pb-btn secondary" href="/products">Conocer la selección</Link></section>

    <section className="pb-faq" id="faq"><span className="pb-kicker">FAQ</span><h2>Un catálogo claro y documentado.</h2><details><summary>¿Peptibra fabrica los productos?</summary><p>Peptibra funciona como un hub especializado que consolida inventario y documentación de distintos suplidores seleccionados.</p></details><details><summary>¿Dónde encuentro el COA?</summary><p>Los certificados se organizan por producto y lote, según la documentación disponible del suplidor correspondiente.</p></details><details><summary>¿Puedo comprar desde la página?</summary><p>La compra directa todavía no está habilitada. Próximamente Peptibra incorporará una experiencia de adquisición integrada al catálogo.</p></details><Link className="pb-faq-more" href="/faq">Consultar todas las preguntas →</Link></section>
    <footer id="contacto"><Image src="/peptibra-logo-dark.png" width={1774} height={887} alt="Peptibra" unoptimized/><p>Productos destinados exclusivamente a fines de investigación. No aptos para consumo humano.</p><a href="mailto:peptibra@gmail.com">peptibra@gmail.com</a></footer>
    <section className="pb-legal-disclaimer" aria-label="Research use disclaimer">
      <div>
        <strong>FOR RESEARCH USE ONLY. NOT FOR HUMAN USE.</strong>
        <p><b>FDA Disclaimer:</b> The content and products mentioned on this website have not been evaluated by the U.S. Food and Drug Administration (FDA). These products are not intended to diagnose, treat, cure, or prevent any disease. All products are sold exclusively for research, laboratory, or analytical purposes and are intended for controlled laboratory research use. The information provided is strictly for informational purposes only.</p>
        <p>All products are sold for research, laboratory, or analytical purposes only and are intended for controlled laboratory research use.</p>
        <p>Peptibra is a chemical supplier. Peptibra is not a compounding pharmacy or chemical compounding facility as defined under Section 503A of the Federal Food, Drug, and Cosmetic Act. Peptibra is not an outsourcing facility as defined under Section 503B of the Federal Food, Drug, and Cosmetic Act. The statements made within this website have not been evaluated by the U.S. Food and Drug Administration. The products we offer are not intended to diagnose, treat, cure, or prevent any disease. For laboratory in vitro experimental use only.</p>
        <small>Copyright © 2026 Peptibra</small>
      </div>
    </section>
  </main>;
}
