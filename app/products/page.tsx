import Image from "next/image";
import SiteHeader from "../SiteHeader";
import VerificationGate from "../VerificationGate";
import ProductCatalog from "./ProductCatalog";
export default function ProductsPage(){return <main className="pb-site pb-public-new"><VerificationGate/><SiteHeader/><section className="new-page-head products-head"><div><span>CATÁLOGO</span><h1>Productos</h1><p>Explora productos, presentaciones y disponibilidad.</p></div><Image src="/editorial/peptibra-glp3-bac-ivory.png" width={1536} height={1024} alt="Presentación Peptibra GLP-3 R y BAC Water" priority/></section><section className="new-shop"><ProductCatalog/></section></main>}
