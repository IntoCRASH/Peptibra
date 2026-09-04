"use client";
import {useEffect,useState} from "react";
import {CorporateFooter,CorporateHeader,PrintToolbar} from "../../print-shared";
type Row=Record<string,unknown>; const n=(v:unknown)=>Number(v||0), usd=(v:unknown)=>`$${n(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export default function InvoicePrint({id}:{id:string}){
 const [data,setData]=useState<Record<string,Row[]>>({}); useEffect(()=>{fetch("/api/mobile").then(r=>r.json()).then(setData)},[]);
 const invoice=(data.invoices||[]).find(x=>String(x.id)===id),items=(data.invoiceItems||[]).filter(x=>String(x.invoice_id)===id),products=data.products||[],payments=(data.payments||[]).filter(x=>String(x.invoice_id)===id);
 if(!invoice)return <main className="print-document loading">Cargando factura…</main>;
 const chunks=Array.from({length:Math.max(1,Math.ceil(items.length/10))},(_,i)=>items.slice(i*10,i*10+10));
 const manual=n(invoice.manual_discount_value), manualLabel=String(invoice.manual_discount_type)==="Monto"?usd(manual):`${manual.toFixed(2)}%`;
 const paymentText=payments.length?payments.map(p=>String(p.currency)==="DOP"?`${p.method} RD$${n(p.original_amount).toFixed(2)} (US$${n(p.applied_usd).toFixed(2)}, tasa ${n(p.exchange_rate).toFixed(2)})`:`${p.method} US$${n(p.applied_usd).toFixed(2)}`).join(", "):"Sin pagos registrados";
 return <main className="print-document"><PrintToolbar title={`Factura ${invoice.number}`}/>{chunks.map((chunk,page)=><article className="canonical-sheet" key={page}>
  <CorporateHeader kicker="" title="FACTURA" detail={String(invoice.number)}/>
  <section className="invoice-party-card"><div><small>FACTURAR A</small><h2>{String(invoice.client_code||"")}  |  {String(invoice.client_name||"")}</h2><p>Teléfono: {String(invoice.client_phone||"No indicado")}</p></div><div><small>DETALLES</small><p>Fecha: {String(invoice.created_at||"")}</p><p>Vendedor: {String(invoice.seller_name||"")}</p><b>Estado: {String(invoice.status||"")}</b><em>Descuento aplicado: {manualLabel}</em></div></section>
  <table className="canonical-table"><thead><tr><th>PRODUCTO</th><th>CANT.</th><th>PRECIO/U.</th><th>DESCUENTO</th><th>TOTAL</th></tr></thead><tbody>{chunk.map(x=>{const p=products.find(y=>String(y.id)===String(x.product_id));return <tr key={String(x.id)}><td><b>{String(p?.name||"Producto")} {String(p?.concentration||"")}</b></td><td>{String(x.quantity)}</td><td>{usd(x.unit_price)}</td><td className={n(x.discount_pct)?"green":""}>{n(x.discount_pct)?`${n(x.discount_pct).toFixed(2)}%`:"—"}</td><td><b>{usd(x.total)}</b></td></tr>})}</tbody></table>
  {page===chunks.length-1&&<section className="invoice-bottom"><div><p>Pagos: {paymentText}</p>{Boolean(invoice.notes)&&<p>Notas: {String(invoice.notes)}</p>}</div><aside><p><span>SUBTOTAL</span><b>{usd(invoice.subtotal)}</b></p><p><span>DESCUENTO</span><b className="green">-{usd(Math.abs(n(invoice.discount)))}</b></p><p><span>TOTAL</span><b>{usd(invoice.total)}</b></p><p><span>PAGADO</span><b className="green">{usd(invoice.paid)}</b></p><p><span>SALDO PENDIENTE</span><b className="red">{usd(invoice.balance)}</b></p></aside></section>}
  <CorporateFooter left={`PEPTIBRA  |  ${invoice.number}  |  Página ${page+1} de ${chunks.length}`}/>
 </article>)}</main>;
}
