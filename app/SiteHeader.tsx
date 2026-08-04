import Image from "next/image";
import Link from "next/link";

export default function SiteHeader() {
  return <>
    <header className="pb-header">
      <Link href="/" className="pb-logo" aria-label="Peptibra inicio"><Image src="/peptibra-logo-original.png" width={1774} height={887} alt="Peptibra · Peptide Depot" unoptimized priority/></Link>
      <nav aria-label="Navegación principal">
        <Link href="/products">Catálogo</Link><Link href="/#modelo">Nuestro modelo</Link><Link href="/#reportes">COAs</Link><Link href="/faq">FAQ</Link><Link href="/#contacto">Contacto</Link>
      </nav>
      <Link className="pb-login" href="/admin">Acceso privado</Link>
    </header>
  </>;
}
