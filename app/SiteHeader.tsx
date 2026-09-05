import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "./LanguageProvider";

export default function SiteHeader() {
  return <>
    <header className="pb-header">
      <Link href="/" className="pb-logo" aria-label="Peptibra inicio"><Image src="/peptibra-logo-original.png" width={1774} height={887} alt="Peptibra · Peptide Depot" unoptimized priority/></Link>
      <nav aria-label="Navegación principal">
        <Link href="/products">Catálogo</Link><Link href="/coas">COAs</Link><Link href="/faq">FAQ</Link><Link href="/contact">Contacto</Link>
      </nav>
      <LanguageSwitcher compact/>
      <Link className="pb-login" href="/login?next=%2Fptbr-mobile">Acceso restringido</Link>
    </header>
  </>;
}
