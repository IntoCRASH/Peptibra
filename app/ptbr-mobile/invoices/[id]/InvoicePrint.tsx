"use client";
import Image from "next/image";
import { useEffect,useState } from "react";
type Row=Record<string,unknown>;
const money=(v:unknown)=>`US$${Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export default function InvoicePrint({id}:{id:string}){
 const [data,setData]=useState<Record<string,Row[]>>({});useEffect(()=>{fetch("/api/mobile").then(r=>r.json()).then(setData)},[]);
 const invoice=(data.invoices||[]).find(x=>String(x.id)===id),items=(data.invoiceItems||[]).filter(x=>String(x.invoice_id)===id),products=data.products||[];
 if(!invoice)return <main className="invoice-sheet loading">Cargando factura…</main>;
 return <main className="invoice-print-page"><div className="print-toolbar"><button onClick={()=>window.print()}>Imprimir</button><button onClick={()=>window.print()}>Guardar PDF</button><button onClick={()=>navigator.share?.({title:String(invoice.number),url:location.href})}>Compartir</button></div><article className="invoice-sheet">
  <header><Image src="/peptibra-logo-original.png" width={1774} height={887} alt="Peptibra" priority/><div><span>FACTURA</span><b>{String(invoice.number)}</b><small>{String(invoice.created_at).slice(0,10)}</small></div></header>
  <section className="invoice-parties"><div><small>CLIENTE</small><b>{String(invoice.client_name)}</b><span>{String(invoice.client_code||"")}</span></div><div><small>VENDIDO POR</small><b>{String(invoice.seller_name)}</b><span>{String(invoice.status)}</span></div></section>
  <table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead><tbody>{items.map(x=>{const p=products.find(y=>y.id===x.product_id);return <tr key={String(x.id)}><td><b>{String(p?.name||"Producto")}</b><small>{String(p?.concentration||"")}</small></td><td>{String(x.quantity)}</td><td>{money(x.unit_price)}</td><td>{money(x.total)}</td></tr>})}</tbody></table>
  <section className="invoice-summary"><div><span>Subtotal</span><b>{money(invoice.subtotal)}</b></div><div><span>Descuento</span><b>−{money(invoice.discount)}</b></div><div className="grand"><span>Total</span><b>{money(invoice.total)}</b></div><div><span>Pagado</span><b>{money(invoice.paid)}</b></div><div><span>Pendiente</span><b>{money(invoice.balance)}</b></div></section>
  {Boolean(invoice.notes)&&<p className="invoice-notes"><b>Notas:</b> {String(invoice.notes)}</p>}
  <footer><p><b>IMPORTANTE:</b> PEPTIBRA Peptide Depot™ es un hub digital independiente que canaliza el acceso a péptidos y compuestos exclusivamente para fines de investigación. No somos fabricantes ni laboratorio clínico o farmacéutico. Estos productos no están destinados a diagnosticar, tratar, curar ni prevenir ninguna enfermedad.</p><span>peptibra.com</span></footer>
 </article></main>
}
