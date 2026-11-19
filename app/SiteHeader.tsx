import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "./LanguageProvider";

export default function SiteHeader() {
  return <>
    <header className="pb-header">
      <Link href="/" className="pb-logo" aria-label="Peptibra inicio"><Image src="/brand/peptibra-logo-light.svg" width={980} height={270} alt="Peptibra" unoptimized priority/></Link>
      <nav aria-label="Navegación principal">
        <Link href="/products">Catálogo</Link><Link href="/calculator">Calculadora</Link><Link href="/coas">COAs</Link><Link href="/faq">FAQ</Link><Link href="/contact">Contacto</Link>
      </nav>
      <LanguageSwitcher compact/>
      <Link className="pb-login" href="/login?next=%2Fptbr-mobile">Acceso restringido</Link>
    </header>
  </>;
}
