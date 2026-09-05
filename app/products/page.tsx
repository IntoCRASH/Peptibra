import SiteHeader from "../SiteHeader";
import VerificationGate from "../VerificationGate";
import ProductCatalog from "./ProductCatalog";
export default function ProductsPage(){return <main className="pb-site pb-public-new"><VerificationGate/><SiteHeader/><section className="new-page-head"><span>CATÁLOGO</span><h1>Productos</h1><p>Explora productos, presentaciones y disponibilidad.</p></section><section className="new-shop"><ProductCatalog/></section></main>}
