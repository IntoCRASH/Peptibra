import SiteHeader from "../SiteHeader";
import VerificationGate from "../VerificationGate";
import ProductCatalog from "./ProductCatalog";

export default function ProductsPage(){return <main className="pb-site"><VerificationGate/><SiteHeader/>
  <section className="pb-shop-head"><span>Inicio / Catálogo</span><h1>Catálogo de péptidos</h1><p>Una selección dinámica con información de lote, disponibilidad y respaldo analítico en un solo lugar.</p></section>
  <div className="pb-shipping">Trazabilidad · documentación por lote · información actualizada</div>
  <section className="pb-shop"><ProductCatalog/></section>
  <footer><p><b>Peptibra · Peptide Depot</b></p><p>Catálogo informativo para fines de investigación.</p><a href="mailto:peptibra@gmail.com">Solicitar información</a></footer>
</main>}
