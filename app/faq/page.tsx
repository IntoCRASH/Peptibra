import Image from "next/image";
import Link from "next/link";
import SiteHeader from "../SiteHeader";
import VerificationGate from "../VerificationGate";

const sections = [
  {
    title: "Peptibra y su catálogo",
    items: [
      {
        question: "¿Qué es Peptibra?",
        answer: "Peptibra es un hub especializado en péptidos de investigación. Reúne en un mismo catálogo información de productos, disponibilidad y documentación analítica procedente de suplidores seleccionados.",
      },
      {
        question: "¿Peptibra fabrica los productos publicados?",
        answer: "No necesariamente. El modelo de Peptibra integra inventario de distintas fuentes evaluadas. En cada entrada buscamos mantener identificados el producto, su presentación, el lote y la documentación que corresponde al suplidor disponible.",
      },
      {
        question: "¿Para qué uso están destinados los productos?",
        answer: "Los productos del catálogo están destinados exclusivamente a investigación in vitro, análisis y trabajo controlado de laboratorio. No son medicamentos, no están destinados al consumo humano o veterinario y Peptibra no ofrece orientación de dosificación o uso clínico.",
      },
    ],
  },
  {
    title: "COAs y evidencia analítica",
    items: [
      {
        question: "¿Cómo puedo consultar un COA?",
        answer: "Los certificados de análisis se organizan por producto y lote. Cuando el documento está disponible, Peptibra lo vincula con la entrada correspondiente para que pueda revisarse junto con la información del inventario.",
      },
      {
        question: "¿Cómo verifico que un COA corresponde al producto publicado?",
        answer: "Compara el nombre del compuesto, número de lote, presentación, fecha del análisis y laboratorio emisor. Cuando existe una página de verificación externa, Peptibra procura incluir el enlace directo para facilitar la trazabilidad.",
      },
      {
        question: "¿Qué indica una prueba de pureza HPLC?",
        answer: "La cromatografía HPLC separa los componentes detectables de una muestra y permite estimar la proporción atribuida al compuesto principal. El resultado describe la muestra o lote analizado; no demuestra esterilidad, seguridad clínica, dosificación ni idoneidad para uso humano.",
      },
      {
        question: "¿Todos los productos tienen pruebas de esterilidad, endotoxinas o metales pesados?",
        answer: "No se presume ninguna prueba que no esté expresamente documentada. Esos análisis pueden formar parte de controles de laboratorio más amplios, pero Peptibra solo comunica los resultados que aparecen en la documentación específica del producto o lote.",
      },
      {
        question: "¿Un COA convierte el producto en un medicamento aprobado?",
        answer: "No. Un COA aporta resultados analíticos sobre una muestra determinada. No constituye aprobación regulatoria, evaluación médica ni evidencia para diagnóstico, tratamiento, prevención o consumo.",
      },
    ],
  },
  {
    title: "Disponibilidad y soporte",
    items: [
      {
        question: "¿La disponibilidad del catálogo se actualiza?",
        answer: "Sí. La disponibilidad puede variar según el inventario de Peptibra y de sus suplidores. El catálogo se actualiza conforme se incorporan nuevos lotes, presentaciones y documentos.",
      },
      {
        question: "¿Puedo comprar directamente desde la página?",
        answer: "Todavía no. Peptibra funciona actualmente como catálogo informativo y centro de consulta. Estamos preparando una experiencia de adquisición segura, con disponibilidad actualizada y documentación asociada a cada lote.",
      },
      {
        question: "¿Cómo solicito información sobre un producto o documento?",
        answer: "Escríbenos a peptibra@gmail.com e indica el nombre del producto y, si aplica, el número de lote. Esto nos permite responder con la información más pertinente.",
      },
    ],
  },
];

export default function FAQPage() {
  return <main className="pb-site"><VerificationGate/><SiteHeader/>
    <section className="pb-faq-hero">
      <span className="pb-kicker">CENTRO DE INFORMACIÓN</span>
      <h1>Preguntas frecuentes</h1>
      <p>Respuestas claras sobre el modelo de Peptibra, la documentación analítica y la forma correcta de interpretar nuestro catálogo.</p>
      <div><Link href="/products">Explorar catálogo</Link><a href="mailto:peptibra@gmail.com">Contactar a Peptibra</a></div>
    </section>
    <section className="pb-faq-layout">
      <aside><span>EN ESTA PÁGINA</span>{sections.map(section=><a key={section.title} href={`#${section.title.toLowerCase().replaceAll(" ","-").replaceAll("á","a")}`}>{section.title}</a>)}</aside>
      <div className="pb-faq-groups">{sections.map(section=>{
        const id=section.title.toLowerCase().replaceAll(" ","-").replaceAll("á","a");
        return <section id={id} key={section.title}><span className="pb-kicker">{section.title}</span>{section.items.map(item=><details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>;
      })}</div>
    </section>
    <section className="pb-faq-contact"><span className="pb-kicker">¿NECESITAS MÁS INFORMACIÓN?</span><h2>Conversemos sobre tu consulta.</h2><p>Indica el producto o lote de interés para ayudarte con mayor precisión.</p><a className="pb-btn primary" href="mailto:peptibra@gmail.com">Escribir a Peptibra →</a></section>
    <footer><Image src="/peptibra-logo-dark.png" width={1774} height={887} alt="Peptibra" unoptimized/><p>Productos destinados exclusivamente a fines de investigación. No aptos para consumo humano.</p><a href="mailto:peptibra@gmail.com">peptibra@gmail.com</a></footer>
  </main>;
}
