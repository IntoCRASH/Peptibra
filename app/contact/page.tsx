import Image from "next/image";
import Link from "next/link";
import SiteHeader from "../SiteHeader";
import VerificationGate from "../VerificationGate";
import ContactForm from "./ContactForm";

export default function ContactPage(){return <main className="pb-site"><VerificationGate/><SiteHeader/>
  <section className="pb-contact-hero"><span className="pb-kicker">PEPTIBRA SUPPORT</span><h1>How can we help?</h1><p>Contact us for product information, batch-specific documentation, COAs, catalog availability, or general research account questions.</p><div><Link href="/products">Explore catalog</Link><Link href="/faq">Visit FAQ</Link></div></section>
  <section className="pb-contact-layout">
    <aside className="pb-contact-info">
      <article><span>RESPONSE TIME</span><h2>Support hours</h2><p>We typically reply within 24 hours, and usually faster when we are online.</p><dl><div><dt>Monday–Friday</dt><dd>10 AM–6 PM PT</dd></div><div><dt>Saturday</dt><dd>10 AM–2 PM PT</dd></div><div><dt>Sunday & holidays</dt><dd>Closed</dd></div></dl></article>
      <article><span>DIRECT CONTACT</span><h2>Email Peptibra</h2><p>For the fastest response, include the product name and batch number when available.</p><a href="mailto:peptibra@gmail.com">peptibra@gmail.com</a></article>
      <article><span>BEFORE YOU WRITE</span><h2>Documentation resources</h2><p>Quick answers about COAs, testing, availability, and research-only use may already be available.</p><Link href="/faq">Review frequently asked questions →</Link></article>
    </aside>
    <ContactForm/>
  </section>
  <footer><Image src="/peptibra-logo-dark.png" width={1774} height={887} alt="Peptibra" unoptimized/><p>Products intended exclusively for research purposes. Not for human consumption.</p><a href="mailto:peptibra@gmail.com">peptibra@gmail.com</a></footer>
</main>}
