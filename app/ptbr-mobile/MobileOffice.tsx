/* eslint-disable @next/next/no-img-element -- Inventory images are user-managed remote assets. */
"use client";
import Image from "next/image";
import "./mobile-enhancements.css";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Row = Record<string, unknown>;
type View = "home" | "sales" | "inventory" | "clients" | "loyalty" | "cash" | "protocols" | "more";
const money = (v: unknown) =>
  `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const val = (form: HTMLFormElement) => Object.fromEntries(new FormData(form));
const rowMonth = (row: Row) => String(row.created_at || row.updated_at || "").slice(0, 7);
const currentMonthValue = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; };
const isInvoiceOverdue = (invoice: Row) => {
  if (Number(invoice.balance || 0) <= 0.005) return false;
  const issued = new Date(String(invoice.created_at || ""));
  return Number.isFinite(issued.getTime()) && Date.now() - issued.getTime() > 15 * 24 * 60 * 60 * 1000;
};
const isInvoicePending = (invoice: Row) => {
  const status = String(invoice.status || "").trim().toLocaleLowerCase("es");
  return Number(invoice.balance || 0) > 0.005 && !["pagada", "cancelada", "anulada", "eliminada"].includes(status);
};
const TrashIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const BellIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;

export default function MobileOffice({
  userName,
  signOut,
}: {
  userName: string;
  signOut: string;
}) {
  const [data, setData] = useState<Record<string, Row[]>>({}),
    [view, setView] = useState<View>("home"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [modal, setModal] = useState<string | null>(null),
    [selected, setSelected] = useState<Row | null>(null),
    [search, setSearch] = useState(""),
    [salesFilter, setSalesFilter] = useState<"all" | "pending">("all"),
    [reportMonth, setReportMonth] = useState(currentMonthValue),
    [cashRange, setCashRange] = useState<"month" | "year" | "all">("month"),
    [cashYear, setCashYear] = useState(() => currentMonthValue().slice(0, 4)),
    [inventoryDrafts, setInventoryDrafts] = useState<Record<number, string>>({}),
    [selectedDeliveryInvoices, setSelectedDeliveryInvoices] = useState<number[]>([]);
  const inventoryPending = useRef(new Map<number, number>()),
    inventoryTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>()),
    inventorySaving = useRef(new Map<number, Promise<void>>());
  const load = useCallback(async () => {
    setLoading(true);
    await fetch("/api/exchange-rate").catch(() => null);
    const r = await fetch("/api/mobile");
    const j = await r.json();
    if (!r.ok) setError(j.error || "No se pudo cargar");
    else {
      setData(j);
      setError("");
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const post = async (action: string, payload: Row) => {
    if (
      action === "openSettings" ||
      (action === "saveSetting" && payload.key === "last_mobile_access")
    ) {
      window.location.href = "/office/settings";
      return;
    }
    setError("");
    const r = await fetch("/api/mobile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, data: payload }),
      }),
      j = await r.json();
    if (!r.ok) {
      setError(j.error || "No se pudo guardar");
      return j;
    }
    if (!["touchRevision", "createInvoice", "updateInvoice"].includes(action))
      await fetch("/api/mobile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "touchRevision", data: {} }),
      });
    setModal(null);
    setSelected(null);
    await load();
    return j;
  };
  const products = data.products || [],
    balances = data.balances || [],
    team = data.team || [],
    clients = data.clients || [],
    inactiveClients = data.inactiveClients || [],
    invoices = data.invoices || [],
    invoiceItems = data.invoiceItems || [],
    payments = data.payments || [],
    cash = data.cash || [],
    suppliers = data.suppliers || [],
    purchases = data.purchases || [],
    protocols = data.protocols || [],
    internalWithdrawals = data.internalWithdrawals || [],
    withdrawalPayments = data.withdrawalPayments || [],
    inventoryLots = data.inventoryLots || [],
    loyaltyRewards = data.loyaltyRewards || [],
    auditLog = data.auditLog || [],
    settings = data.settings || [],
    notificationReads = ((data as unknown as { notificationReads?: string[] }).notificationReads || []),
    notificationDismissed = ((data as unknown as { notificationDismissed?: string[] }).notificationDismissed || []),
    access = (data as unknown as { user?: Row }).user || {},
    snapshot =
      (data as unknown as { financialSnapshot?: Row }).financialSnapshot || {},
    currentExchangeRate =
      (data as unknown as { currentExchangeRate?: Row }).currentExchangeRate || {},
    bacRules =
      (data as unknown as { bacRules?: Row }).bacRules || {},
    role = String(access.role || "vendedor"),
    isAdmin = role === "admin",
    isPartner = role === "socio",
    isSeller = role === "vendedor";
  const notificationNow=Date.now(),dayMs=24*60*60*1000,pendingNotifications=invoices.filter(isInvoicePending).map(invoice=>{const days=Math.max(0,Math.floor((notificationNow-new Date(String(invoice.created_at||"")).getTime())/dayMs));return{key:`invoice:${String(invoice.id)}`,kind:"cobro",urgent:days>15,title:days>15?"Factura vencida":"Factura pendiente de cobro",detail:`${String(invoice.number)} · ${String(invoice.client_name)} · ${money(invoice.balance)}`,meta:days>0?`Pendiente desde hace ${days} día(s)`:"Pendiente de cobro",invoice,client:null as Row|null}}),latestInvoiceByClient=new Map<number,Row>();
  for(const invoice of invoices){const clientId=Number(invoice.client_id),current=latestInvoiceByClient.get(clientId);if(!current||new Date(String(invoice.created_at||"")).getTime()>new Date(String(current.created_at||"")).getTime())latestInvoiceByClient.set(clientId,invoice)}
  const followupNotifications=[...latestInvoiceByClient.values()].flatMap(invoice=>{const days=Math.max(0,Math.floor((notificationNow-new Date(String(invoice.created_at||"")).getTime())/dayMs));if(days<30)return[];const names=[...new Set(invoiceItems.filter(item=>Number(item.invoice_id)===Number(invoice.id)).map(item=>String(products.find(product=>Number(product.id)===Number(item.product_id))?.name||"Producto")))],client=clients.find(item=>Number(item.id)===Number(invoice.client_id));return[{key:`followup:${String(invoice.id)}`,kind:"seguimiento",urgent:false,title:"Seguimiento de recompra",detail:`${String(invoice.client_name)} · ${names.join(", ")||"Productos adquiridos"}`,meta:`Han pasado ${days} días desde su compra`,invoice,client}]});
  const teamSaleNotifications=isAdmin?invoices.flatMap(invoice=>{const age=notificationNow-new Date(String(invoice.created_at||"")).getTime();if(age<0||age>30*dayMs||Number(invoice.seller_id)===Number(access.inventoryTeamId))return[];const names=[...new Set(invoiceItems.filter(item=>Number(item.invoice_id)===Number(invoice.id)).map(item=>String(products.find(product=>Number(product.id)===Number(item.product_id))?.name||"Producto")))];return[{key:`team-sale:${String(invoice.id)}`,kind:"venta-equipo",urgent:false,title:`${String(invoice.seller_name||"Un integrante")} realizó una nueva venta`,detail:`${names.join(", ")||"Productos vendidos"} · ${money(invoice.total)}`,meta:`Factura ${String(invoice.number)} · ${String(invoice.client_name)}`,invoice,client:null as Row|null}]}):[];
  const notifications=[...pendingNotifications,...teamSaleNotifications,...followupNotifications].filter(notification=>!notificationDismissed.includes(notification.key)).sort((a,b)=>Number(b.urgent)-Number(a.urgent)||a.kind.localeCompare(b.kind)),unreadNotifications=notifications.filter(notification=>!notificationReads.includes(notification.key));
  const saveNotificationReads=async(ids:string[])=>{const unique=[...new Set(ids)];setData(current=>({...current,notificationReads:unique} as unknown as Record<string,Row[]>));await fetch("/api/mobile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"saveNotificationReads",data:{ids:unique}})})};
  const dismissNotification=async(key:string)=>{const unique=[...new Set([...notificationDismissed,key])];setData(current=>({...current,notificationDismissed:unique} as unknown as Record<string,Row[]>));await fetch("/api/mobile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"saveNotificationDismissed",data:{ids:unique}})})};
  const inventoryLocation = access.inventoryTeamId ? `VENDEDOR:${Number(access.inventoryTeamId)}` : "GENERAL";
  const stock = (id: unknown) =>
      balances
        .filter((x) => x.product_id === id && String(x.location) === inventoryLocation)
        .reduce((s, x) => s + Number(x.quantity || 0), 0),
    cashTotal = Number(snapshot.cash || 0),
    retention = Number(snapshot.retention || 0),
    netProfit = Number(snapshot.realizedNet || 0),
    retained = Number(snapshot.retained || 0),
    supplierDue = Number(snapshot.supplierDue || 0),
    distributable = Number(snapshot.distributable || 0),
    partnerBalances = team
      .filter((x) => x.role === "Socio")
      .map((partner) => ({
        partner,
        amount: cash
          .filter((x) => x.partner_id === partner.id)
          .reduce(
            (s, x) =>
              s +
              ([
                "Aporte socio",
                "Inventario pagado por socio",
                "Pago proveedor por socio",
              ].includes(String(x.category))
                ? Number(x.amount || 0)
                : ["Devolución aporte", "Compensación retiro/aporte"].includes(
                      String(x.category),
                    )
                  ? -Number(x.amount || 0)
                  : 0),
            0,
          ),
      }));
  const alphabeticalProducts = [...products].sort((a,b)=>`${String(a.name)} ${String(a.concentration)}`.localeCompare(`${String(b.name)} ${String(b.concentration)}`,"es",{sensitivity:"base",numeric:true}));
  const filtered = alphabeticalProducts.filter((p) =>
      `${p.name} ${p.concentration}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
    safeView: View =
      isSeller && !(["home", "sales", "inventory", "protocols", "clients"] as View[]).includes(view)
        ? "home"
        : isPartner &&
            !(["home", "sales", "inventory", "protocols", "clients"] as View[]).includes(
              view,
            )
          ? "home"
          : view;
  return (
    <main className="mobile-office">
      <header className="mobile-top">
        <div className="mobile-logo">
          <Image
            src="/brand/peptibra-logo-dark.svg"
            width={980}
            height={270}
            alt="Peptibra Peptide Depot"
            unoptimized
            priority
          />
        </div>
        <label className="flow-search">
          <span>⌕</span>
          <input
            value={search}
            placeholder="Buscar productos…"
            onFocus={() => setView("inventory")}
            onChange={(event) => {
              setSearch(event.target.value);
              setView("inventory");
            }}
          />
        </label>
        <div className="mobile-account">
          <button className="notification-button" type="button" aria-label={`${unreadNotifications.length} notificaciones pendientes`} onClick={()=>setModal("Notificaciones")}><span><BellIcon/></span>{unreadNotifications.length>0&&<b>{unreadNotifications.length>99?"99+":unreadNotifications.length}</b>}</button>
          <span className="sync-pill">✓ Sincronizado</span>
          <b>{userName.split(" ")[0]}</b>
          <a href="/office/settings">Cambiar contraseña</a>
          <a href={signOut}>Salir</a>
        </div>
      </header>
      {error && (
        <div className="mobile-error">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      <section className="mobile-content">
        {loading ? (
          <div className="mobile-loading">
            <i />
            <p>Actualizando datos…</p>
          </div>
        ) : safeView === "home" ? (
          <Home />
        ) : safeView === "sales" ? (
          <Sales />
        ) : safeView === "inventory" ? (
          Inventory()
        ) : safeView === "clients" ? (
          <Clients />
        ) : safeView === "loyalty" ? (
          <Loyalty />
        ) : safeView === "cash" ? (
          <Cash />
        ) : safeView === "protocols" ? (
          <Protocols />
        ) : (
          <More />
        )}
      </section>
      <nav className={`mobile-nav role-${role}`}>
        <div className="desktop-brand" aria-label="Peptibra">
          <Image
            src="/brand/peptibra-logo-light.svg"
            width={1400}
            height={386}
            alt="Peptibra Peptide Depot"
            unoptimized
          />
        </div>
        {(
          [
            ["home", "⌂", "Inicio"],
            ["sales", "▱", "Vender"],
            ["inventory", "□", "Productos"],
            ["protocols", "⌁", "Protocolos"],
            ["cash", "▣", "Caja"],
            ["more", "•••", "Más"],
            ["clients", "○", "Clientes"],
            ["loyalty", "♥", "Lealtad"],
          ] as [View, string, string][]
        )
          .filter(
            ([id]) =>
              isAdmin ||
              (isPartner &&
                ["home", "sales", "inventory", "protocols", "clients"].includes(id)) ||
              (isSeller && ["home", "sales", "inventory", "protocols", "clients"].includes(id)),
          )
          .map(([id, icon, label]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => { if (id === "sales") setSalesFilter("all"); setView(id); }}
            >
              <i>{icon}</i>
              <span>{label}</span>
            </button>
          ))}
        <div className="desktop-monthyva">
          <span>TECNOLOGÍA POR</span>
          <Image
            src="/brand/monthyva-wordmark.png"
            width={640}
            height={160}
            alt="Monthyva"
            unoptimized
          />
        </div>
      </nav>
      {modal && (
        <Modal
          title={modal}
          close={() => {
            setModal(null);
            setSelected(null);
          }}
        >
          {modal === "Detalle de factura" ? (
            <InvoiceDetail invoice={selected!} />
          ) : modal === "Ficha del cliente" ? (
            <ClientDetail client={selected!} />
          ) : modal === "Notificaciones" ? (
            <NotificationCenter />
          ) : modal === "Aplicar pago" ? (
            <PaymentForm invoice={selected!} />
          ) : modal === "Pagar a Peptibra" ? (
            <PeptibraPaymentForm />
          ) : modal === "Pagar retiro" ? (
            <WithdrawalPayment initial={selected!} />
          ) : modal === "BAC Lab" ? (
            <BacLab />
          ) : modal === "Lotes y trazabilidad" ? (
            <InventoryLotsForm product={selected!} />
          ) : modal === "Canjear premio" ? (
            <RewardRedemptionForm reward={selected!} />
          ) : modal === "Auditoría" ? (
            <AuditLog />
          ) : modal.toLowerCase().includes("retiro") ? (
            <WithdrawalForm />
          ) : modal === "Catálogo público" ? (
            <CatalogVisibilityForm />
          ) : modal.toLowerCase().includes("producto") ? (
            <ProductForm initial={selected} />
          ) : modal.toLowerCase().includes("cliente") ? (
            <ClientForm initial={selected} />
          ) : modal.toLowerCase().includes("factura") ? (
            <InvoiceForm initial={selected} />
          ) : modal === "Movimiento de caja" ? (
            <CashForm />
          ) : modal.toLowerCase().includes("integrante") ? (
            <TeamForm initial={selected} />
          ) : modal.toLowerCase().includes("proveedor") ? (
            <SupplierForm initial={selected} />
          ) : modal.toLowerCase().includes("compra") ? (
            <PurchaseForm initial={selected} />
          ) : modal.toLowerCase().includes("cálculo") ? (
            <CalculationForm initial={selected} />
          ) : (
            <ProtocolForm initial={selected} />
          )}
        </Modal>
      )}
    </main>
  );

  function Home() {
    const currentMonth = currentMonthValue(),
      monthInvoices = invoices.filter((invoice) => rowMonth(invoice) === reportMonth),
      monthInvoiceIds = new Set(monthInvoices.map((invoice) => Number(invoice.id))),
      monthSales = monthInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
      monthCollected = monthInvoices.reduce((sum, invoice) => sum + Number(invoice.paid || 0), 0),
      monthPending = monthInvoices.reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0),
      monthUnits = invoiceItems
        .filter((item) => monthInvoiceIds.has(Number(item.invoice_id)))
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      monthLabel = new Intl.DateTimeFormat("es-DO", { month: "long", year: "numeric" }).format(
        new Date(`${reportMonth}-01T12:00:00`),
      ),
      lowStock = products.filter((p) => stock(p.id) <= 0).length,
      pendingInvoices = invoices.filter(isInvoicePending),
      overdueInvoices = pendingInvoices.filter(isInvoiceOverdue),
      allPending = pendingInvoices.reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0),
      pendingRemittances = cash.filter((m) => String(m.category) === "Pago a Peptibra pendiente"),
      monthProductUnits = invoiceItems.filter(item=>monthInvoiceIds.has(Number(item.invoice_id))).reduce((totals,item)=>{const productId=Number(item.product_id);totals.set(productId,(totals.get(productId)||0)+Number(item.quantity||0));return totals},new Map<number,number>()),
      topProducts=[...monthProductUnits.entries()].map(([productId,units])=>{const product=products.find(item=>Number(item.id)===productId);return{productId,units,name:String(product?.name||"Producto"),concentration:String(product?.concentration||"")}}).sort((a,b)=>b.units-a.units||`${a.name} ${a.concentration}`.localeCompare(`${b.name} ${b.concentration}`,"es")).slice(0,5),
      maxProductUnits=Math.max(1,...topProducts.map(item=>item.units));
    return (
      <>
        <div className="flow-greeting">
          <small>{isSeller ? "MI ESPACIO" : "PEPTIBRA 2.0"}</small>
          <h1>¿Qué quieres hacer?</h1>
          <p>Elige una acción y te llevamos directo.</p>
        </div>
        <div className={`flow-actions ${!isAdmin ? "seller" : ""}`}>
          <FlowAction
            icon="▱"
            title="Vender"
            hint="Crear una factura"
            tone="rose"
            action={() => { setSelected(null); setModal("Nueva factura"); }}
          />
          {isAdmin ? (
            <>
              <FlowAction
                icon="▣"
                title="Cobrar"
                hint="Registrar un pago"
                tone="sage"
                action={() => { setSalesFilter("pending"); setView("sales"); }}
              />
              <FlowAction
                icon="⇄"
                title="Mover inventario"
                hint="Asignar o ajustar"
                tone="blue"
                action={() => setView("inventory")}
              />
              <FlowAction
                icon="▤"
                title="Registrar gasto"
                hint="Anotar una salida"
                tone="amber"
                action={() => setModal("Movimiento de caja")}
              />
            </>
          ) : (
            <>
              <FlowAction icon="▣" title="Cobrar" hint="Registrar un pago" tone="sage" action={() => { setSalesFilter("pending"); setView("sales"); }} />
              {isSeller && <FlowAction icon="↑" title="Pagar" hint="Pagar a Peptibra" tone="blue" action={() => setModal("Pagar a Peptibra")} />}
            </>
          )}
        </div>
        <section className="dashboard-period" aria-label="Período del resumen de ventas">
          <div>
            <small>RESUMEN DE VENTAS</small>
            <b>{monthLabel}</b>
            <span>{monthInvoices.length} factura(s) en el período</span>
          </div>
          <label>
            Consultar mes
            <input
              type="month"
              value={reportMonth}
              max={currentMonth}
              onChange={(event) => setReportMonth(event.target.value || currentMonth)}
            />
          </label>
        </section>
        <div className={`flow-strip ${!isAdmin ? "team" : ""}`}>
          <Card label={isAdmin ? "Ventas del mes" : "Mis ventas del mes"} value={money(monthSales)} tone="green" />
          <Card label="Cobrado de esas facturas" value={money(monthCollected)} tone="blue" />
          <Card label="Por cobrar del mes" value={money(monthPending)} tone="amber" />
          <Card label={isAdmin ? "Unidades del mes" : "Mis unidades del mes"} value={String(monthUnits)} tone="rose" />
        </div>
        <div className="dashboard-current-state">
          <span><small>Caja actual</small><b>{money(cashTotal)}</b></span>
          <span><small>Inventario actual</small><b>{products.reduce((sum, product) => sum + stock(product.id), 0)} unidades</b></span>
          {!isAdmin && <span><small>Mis comisiones acumuladas</small><b>{money(access.commissionTotal)}</b></span>}
        </div>
        <section className="top-products-panel">
          <header><div><small>DESEMPEÑO DEL PERÍODO</small><h2>Productos más vendidos</h2></div><span>{monthLabel}</span></header>
          {topProducts.length?<div>{topProducts.map((item,index)=><article key={item.productId}><b>{String(index+1).padStart(2,"0")}</b><div><span>{item.name}</span><small>{item.concentration||"Presentación general"}</small><i><em style={{width:`${Math.max(8,item.units/maxProductUnits*100)}%`}}/></i></div><strong>{item.units}<small> unidad{item.units===1?"":"es"}</small></strong></article>)}</div>:<p>No hay productos facturados en este mes.</p>}
        </section>
        <ListTitle title="Para resolver" action={() => { setSalesFilter("pending"); setView("sales"); }} />
        <div className="resolve-list">
          {isAdmin && pendingRemittances.length > 0 && (
            <button onClick={() => setView("cash")}>
              <i>↑</i>
              <span>
                <b>{pendingRemittances.length} pago(s) a Peptibra por confirmar</b>
                <small>{money(pendingRemittances.reduce((sum, item) => sum + Number(item.amount || 0), 0))} notificado</small>
              </span>
              <em>Revisar</em>
            </button>
          )}
          {pendingInvoices.length ? (
            <button onClick={() => { setSalesFilter("pending"); setView("sales"); }}>
              <i>▤</i>
              <span>
                <b>{pendingInvoices.length} factura(s) por cobrar</b>
                <small>
                  {money(allPending)} pendiente
                  {overdueInvoices.length > 0 ? ` · 🔔 ${overdueInvoices.length} con más de 15 días` : ""}
                </small>
              </span>
              <em>Cobrar</em>
            </button>
          ) : (
            <button>
              <i>✓</i>
              <span>
                <b>Todo cobrado por ahora</b>
                <small>No hay facturas pendientes</small>
              </span>
            </button>
          )}
          {lowStock ? (
              <button onClick={() => setView("inventory")}>
                <i>□</i>
                <span>
                  <b>{lowStock} producto(s) necesitan atención</b>
                  <small>Inventario en cero o negativo</small>
                </span>
                <em>Ver</em>
              </button>
            ) : (
              <button>
                <i>✓</i>
                <span>
                  <b>Inventario sin alertas</b>
                  <small>Todo está disponible</small>
                </span>
              </button>
            )}
        </div>
        <ListTitle title={`Facturas de ${monthLabel}`} action={() => { setSalesFilter("all"); setView("sales"); }} />
        <div className="mobile-list recent-flow">
          {monthInvoices.slice(0, 4).map((i) => (
            <article
              key={String(i.id)}
              onClick={() => {
                setSelected(i);
                setModal("Detalle de factura");
              }}
            >
              <div>
                <b>{String(i.client_name)} {isInvoiceOverdue(i) && <span className="overdue-bell" title="Factura pendiente con más de 15 días" aria-label="Factura vencida">🔔</span>}</b>
                <span>{String(i.number)}</span>
              </div>
              <div className="right">
                <b>{money(i.total)}</b>
                {Number(i.total_dop) > 0 && <small>RD${Number(i.total_dop).toLocaleString("en-US", { maximumFractionDigits: 0 })}</small>}
                <em className={String(i.status).toLowerCase()}>
                  {String(i.status)}
                </em>
              </div>
            </article>
          ))}
          {!monthInvoices.length && <div className="empty-state">No hay facturas registradas en {monthLabel}.</div>}
        </div>
      </>
    );
  }
  function NotificationCenter(){
    const read=(key:string)=>saveNotificationReads([...notificationReads,key]);
    return <section className="notification-center">
      <header><div><small>CENTRO DE SEGUIMIENTO</small><h3>{unreadNotifications.length} pendiente(s) por leer</h3></div>{unreadNotifications.length>0&&<button type="button" onClick={()=>saveNotificationReads([...notificationReads,...notifications.map(item=>item.key)])}>Marcar todas como leídas</button>}</header>
      <div>{notifications.length?notifications.map(item=><article className={`${item.urgent?"urgent ":""}${notificationReads.includes(item.key)?"read":"unread"}`} key={item.key}><i>{item.kind==="cobro"?(item.urgent?"🔔":"$"):item.kind==="venta-equipo"?"🏆":"↻"}</i><div><small>{item.kind==="cobro"?"COBRO":item.kind==="venta-equipo"?"LOGRO DEL EQUIPO":"SEGUIMIENTO 30 DÍAS"}</small><b>{item.title}</b><p>{item.detail}</p><span>{item.meta}</span></div><aside>{!notificationReads.includes(item.key)&&<button type="button" onClick={()=>read(item.key)}>Marcar leída</button>}<button type="button" className="primary" onClick={()=>{read(item.key);if(item.kind==="cobro"||item.kind==="venta-equipo"){setSelected(item.invoice);setModal("Detalle de factura")}else if(item.client){setSelected(item.client);setModal("Ficha del cliente")}}}>{item.kind==="seguimiento"?"Ver cliente":"Ver factura"}</button><button type="button" className="trash-button" title="Eliminar notificación" aria-label="Eliminar notificación" onClick={()=>dismissNotification(item.key)}><TrashIcon/></button></aside></article>):<div className="notification-empty"><i>✓</i><b>Todo está al día</b><p>No hay cobros ni seguimientos pendientes.</p></div>}</div>
    </section>
  }
  function Sales() {
    const currentMonth=currentMonthValue(),periodInvoices=invoices.filter(invoice=>rowMonth(invoice)===reportMonth),visibleInvoices=(salesFilter === "pending" ? periodInvoices.filter(isInvoicePending) : periodInvoices),periodLabel=new Intl.DateTimeFormat("es-DO",{month:"long",year:"numeric"}).format(new Date(`${reportMonth}-01T12:00:00`)),periodTotal=periodInvoices.reduce((sum,invoice)=>sum+Number(invoice.total||0),0),periodPaid=periodInvoices.reduce((sum,invoice)=>sum+Number(invoice.paid||0),0),periodPending=periodInvoices.reduce((sum,invoice)=>sum+Number(invoice.balance||0),0);
    const visibleIds=visibleInvoices.map(invoice=>Number(invoice.id)),allVisibleSelected=visibleIds.length>0&&visibleIds.every(id=>selectedDeliveryInvoices.includes(id));
    const toggleInvoice=(id:number)=>setSelectedDeliveryInvoices(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
    const toggleAll=()=>setSelectedDeliveryInvoices(current=>allVisibleSelected?current.filter(id=>!visibleIds.includes(id)):[...new Set([...current,...visibleIds])]);
    const updateSelected=async(status:"Entregada"|"Pendiente de entrega")=>{const ids=selectedDeliveryInvoices.filter(id=>visibleIds.includes(id));if(!ids.length)return;await post("updateDeliveryStatusBulk",{invoiceIds:ids,status});setSelectedDeliveryInvoices([])};
    return (
      <>
        <PageHead
          eyebrow={isSeller ? "MIS RESULTADOS" : "OPERACIONES"}
          title={isSeller ? "Mis ventas y comisiones" : "Ventas y facturas"}
          action="+ Factura"
          onAction={() => { setSelected(null); setModal("Nueva factura"); }}
        />
        <section className="sales-period" aria-label="Período de facturas">
          <div><small>FACTURAS DEL PERÍODO</small><b>{periodLabel}</b><span>{periodInvoices.length} factura(s)</span></div>
          <label>Mes y año<input type="month" value={reportMonth} max={currentMonth} onChange={event=>setReportMonth(event.target.value||currentMonth)}/></label>
        </section>
        <div className="sales-period-totals">
          <span><small>Total facturado</small><b>{money(periodTotal)}</b></span>
          <span><small>Total cobrado</small><b>{money(periodPaid)}</b></span>
          <span><small>Pendiente</small><b>{money(periodPending)}</b></span>
        </div>
        <div className="sales-filter" role="group" aria-label="Filtrar facturas">
          <button type="button" className={salesFilter === "pending" ? "active" : ""} onClick={() => setSalesFilter("pending")}>Pendientes ({periodInvoices.filter(isInvoicePending).length})</button>
          <button type="button" className={salesFilter === "all" ? "active" : ""} onClick={() => setSalesFilter("all")}>Todas</button>
        </div>
        {visibleInvoices.length>0&&<div className="delivery-bulk-toolbar">
          <label><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll}/> Seleccionar todas las visibles</label>
          <span>{selectedDeliveryInvoices.filter(id=>visibleIds.includes(id)).length} seleccionada(s)</span>
          <div><button type="button" disabled={!selectedDeliveryInvoices.some(id=>visibleIds.includes(id))} onClick={()=>updateSelected("Entregada")}>Marcar entregadas</button><button type="button" className="secondary" disabled={!selectedDeliveryInvoices.some(id=>visibleIds.includes(id))} onClick={()=>updateSelected("Pendiente de entrega")}>Marcar pendientes</button></div>
        </div>}
        {isSeller && (
          <div className="cash-hero">
            <span>Mis ventas y comisiones</span>
            <b>{money(access.commissionEarned)}</b>
            <small>
              Comisión generada al {Number(access.commissionRate || 0).toFixed(2)}% sobre ventas ya cobradas
            </small>
            <div className="commission-breakdown">
              <span><small>Ventas cobradas</small><strong>{money(access.salesCollected)}</strong></span>
              <span><small>Ventas por cobrar</small><strong>{money(access.salesPending)}</strong></span>
              <span><small>Comisión pendiente del cliente</small><strong>{money(access.commissionPendingCollection)}</strong></span>
              <span><small>Comisión ya pagada</small><strong>{money(access.commissionPaid)}</strong></span>
              <span><small>Comisión disponible por pagar</small><strong>{money(access.commissionDue)}</strong></span>
            </div>
          </div>
        )}
        <div className="mobile-list roomy">
          {visibleInvoices.map((i) => (
            <article
              key={String(i.id)}
              className={selectedDeliveryInvoices.includes(Number(i.id))?"delivery-selected":""}
              onClick={() => {
                setSelected(i);
                setModal("Detalle de factura");
              }}
            >
              <label className="delivery-select" onClick={event=>event.stopPropagation()}><input type="checkbox" aria-label={`Seleccionar factura ${String(i.number)}`} checked={selectedDeliveryInvoices.includes(Number(i.id))} onChange={()=>toggleInvoice(Number(i.id))}/></label>
              <div>
                <b>{String(i.number)} {isInvoiceOverdue(i) && <span className="overdue-bell" title="Factura pendiente con más de 15 días" aria-label="Factura vencida">🔔</span>}</b>
                <span>
                  {String(i.client_name)} · {String(i.seller_name)}
                </span>
                <small>{String(i.created_at).slice(0, 10)}</small>
                <small className={`delivery-badge ${String(i.delivery_status)==="Entregada"?"delivered":"pending"}`}>{String(i.delivery_status||"Pendiente de entrega")}</small>
              </div>
              <div className="right">
                <b>{money(i.total)}</b>
                {Number(i.total_dop) > 0 && <small>RD${Number(i.total_dop).toLocaleString("en-US", { maximumFractionDigits: 0 })}</small>}
                <em className={String(i.status).toLowerCase()}>
                  {String(i.status)}
                </em>
              </div>
            </article>
          ))}
          {!visibleInvoices.length && <div className="empty-state">No hay facturas pendientes de cobro.</div>}
        </div>
      </>
    );
  }
  function Inventory() {
    const base =
      process.env.NEXT_PUBLIC_PEPTIBRA_FILES_URL ||
      "https://peptibra-api.peptibra-management.workers.dev/files";
    return (
      <>
        <PageHead
          eyebrow="PRODUCTOS"
          title={isAdmin ? "Inventario" : "Inventario disponible"}
          action={isAdmin ? "+ Producto" : undefined}
          onAction={() => setModal("Nuevo producto")}
        />
        <div className="inventory-total-card">
          <span><small>Total disponible</small><b>{products.reduce((sum, product) => sum + stock(product.id), 0)} unidades</b></span>
          <span><small>Presentaciones activas</small><b>{products.length}</b></span>
        </div>
        {isAdmin && (
          <div className="inventory-admin-actions">
            <button className="print-module" onClick={() => setModal("Catálogo público")}>◉ Catálogo público</button>
            <button className="print-module" onClick={() => window.location.assign("/ptbr-mobile/price-list")}>Lista de precios · Imprimir / PDF</button>
          </div>
        )}
        <label className="mobile-search">
          ⌕
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto"
          />
        </label>
        <div className="product-mobile-grid">
          {filtered.map((p) => {
            const qty = stock(p.id);
            return (
              <article key={String(p.id)}>
                {p.photo_key ? (
                  <img
                    src={`${base}/${encodeURIComponent(String(p.photo_key))}`}
                    alt=""
                  />
                ) : (
                  <i>{String(p.name).slice(0, 2)}</i>
                )}
                <div
                  onClick={() =>
                    isAdmin &&
                    (() => {
                      setSelected(p);
                      setModal("Editar producto");
                    })()
                  }
                >
                  <b>{String(p.name)}</b>
                  <span>{String(p.concentration)}</span>
                  <strong>{money(p.normal_price || p.price)}</strong>
                </div>
                <aside>
                  <input
                    aria-label={`Existencia de ${String(p.name)} ${String(p.concentration)}`}
                    className={
                      qty < 0
                        ? "inventory-quantity negative"
                        : qty <= Number(p.reorder_point)
                          ? "inventory-quantity low"
                          : "inventory-quantity"
                    }
                    type="number"
                    min="0"
                    step="1"
                    value={inventoryDrafts[Number(p.id)] ?? String(qty)}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => setInventoryDrafts(current => ({...current, [Number(p.id)]: event.target.value}))}
                    onBlur={(event) => setInventoryQuantity(p, event.target.value)}
                  />
                  <span>unidades</span>
                  <div className="inventory-stepper">
                    <button type="button" aria-label={`Restar una unidad a ${String(p.name)}`} onMouseDown={(event) => event.preventDefault()} onClick={() => queueInventoryChange(p, -1)}>−</button>
                    <button type="button" aria-label={`Sumar una unidad a ${String(p.name)}`} onMouseDown={(event) => event.preventDefault()} onClick={() => queueInventoryChange(p, 1)}>+</button>
                  </div>
                  {isAdmin && (
                    <>
                      <button
                        className="edit-link"
                        onClick={() => {
                          setSelected(p);
                          setModal("Lotes y trazabilidad");
                        }}
                      >
                        Lotes
                      </button>
                      <button
                        className="edit-link"
                        onClick={() => {
                          setSelected(p);
                          setModal("Editar producto");
                        }}
                      >
                        Editar
                      </button>
                    </>
                  )}
                </aside>
              </article>
            );
          })}
        </div>
      </>
    );
  }
  function updateLocalStock(productId: number, change: number) {
    const location = inventoryLocation;
    setData((current) => {
      const currentBalances = current.balances || [];
      const found = currentBalances.some((balance) => Number(balance.product_id) === productId && String(balance.location) === location);
      const nextBalances = found
        ? currentBalances.map((balance) => Number(balance.product_id) === productId && String(balance.location) === location
          ? { ...balance, quantity: Number(balance.quantity || 0) + change }
          : balance)
        : [...currentBalances, { product_id: productId, location, quantity: change }];
      return { ...current, balances: nextBalances };
    });
  }
  function queueInventoryChange(product: Row, change: number) {
    const productId = Number(product.id);
    if (!productId || !change) return;
    setInventoryDrafts(current => { const next = {...current}; delete next[productId]; return next; });
    updateLocalStock(productId, change);
    inventoryPending.current.set(productId, (inventoryPending.current.get(productId) || 0) + change);
    const prior = inventoryTimers.current.get(productId);
    if (prior) clearTimeout(prior);
    inventoryTimers.current.set(productId, setTimeout(() => flushInventoryChange(productId), 450));
  }
  function setInventoryQuantity(product: Row, rawValue: string) {
    const productId = Number(product.id);
    if (rawValue.trim() === "") { setInventoryDrafts(current => { const next = {...current}; delete next[productId]; return next; }); return; }
    const target = Math.max(0, Math.trunc(Number(rawValue)));
    if (!Number.isFinite(target)) { setInventoryDrafts(current => { const next = {...current}; delete next[productId]; return next; }); return; }
    const change = target - stock(product.id);
    if (change) queueInventoryChange(product, change);
    else setInventoryDrafts(current => { const next = {...current}; delete next[productId]; return next; });
  }
  async function flushInventoryChange(productId: number) {
    const change = inventoryPending.current.get(productId) || 0;
    inventoryPending.current.delete(productId);
    inventoryTimers.current.delete(productId);
    if (!change) return;
    const previous = inventorySaving.current.get(productId) || Promise.resolve();
    const saving = previous.then(async () => {
      const response = await fetch("/api/mobile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "adjustStock", data: { productId, location: inventoryLocation, change, reason: "Ajuste de inventario propio" } }),
      });
      const result = await response.json();
      if (!response.ok) {
        updateLocalStock(productId, -change);
        setError(result.error || "No se pudo actualizar el inventario");
        return;
      }
      fetch("/api/mobile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "touchRevision", data: {} }) }).catch(() => {});
    }).catch(() => {
      updateLocalStock(productId, -change);
      setError("No se pudo actualizar el inventario");
    });
    inventorySaving.current.set(productId, saving);
    await saving;
    if (inventorySaving.current.get(productId) === saving) inventorySaving.current.delete(productId);
  }
  function CatalogVisibilityForm() {
    const families = [...new Set(products.map((product) => String(product.name)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "es"));
    const stored = settings.find((setting) => setting.key === "web_catalog_names")?.value;
    const initialConfig = (() => {
      if (!stored) return { order: families, visible: families };
      try {
        const parsed = JSON.parse(String(stored));
        if (Array.isArray(parsed)) {
          const visible = parsed.map(String).filter((name) => families.includes(name));
          return { order: [...visible, ...families.filter((name) => !visible.includes(name))], visible };
        }
        if (parsed && typeof parsed === "object") {
          const savedOrder: string[] = Array.isArray(parsed.order) ? parsed.order.map(String) : [];
          const order = [...savedOrder.filter((name) => families.includes(name)), ...families.filter((name) => !savedOrder.includes(name))];
          const visible: string[] = Array.isArray(parsed.visible)
            ? parsed.visible.map(String).filter((name: string) => families.includes(name))
            : families;
          return { order, visible };
        }
        return { order: families, visible: families };
      } catch {
        return { order: families, visible: families };
      }
    })();
    const [orderedNames, setOrderedNames] = useState<string[]>(initialConfig.order);
    const [visibleNames, setVisibleNames] = useState<string[]>(initialConfig.visible);
    const [draggingName, setDraggingName] = useState("");
    const toggle = (name: string) => setVisibleNames((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
    const move = (name: string, target: string) => setOrderedNames((current) => {
      if (!name || name === target) return current;
      const next = current.filter((item) => item !== name);
      next.splice(Math.max(0, next.indexOf(target)), 0, name);
      return next;
    });
    const nudge = (name: string, direction: -1 | 1) => setOrderedNames((current) => {
      const from = current.indexOf(name), to = from + direction;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
    return <form className="catalog-visibility" onSubmit={(event) => {
      event.preventDefault();
      post("saveSetting", { key: "web_catalog_names", value: JSON.stringify({ order: orderedNames, visible: visibleNames }) });
    }}>
      <p>Elige qué familias aparecen en la página pública y arrástralas para definir su orden. Esto no elimina productos ni cambia el inventario.</p>
      <div className="catalog-visibility-tools">
        <button type="button" onClick={() => setVisibleNames(families)}>Mostrar todos</button>
        <button type="button" onClick={() => setVisibleNames([])}>Ocultar todos</button>
        <b>{visibleNames.length} de {families.length} visibles</b>
      </div>
      <div className="catalog-visibility-list">{orderedNames.map((name, index) => {
        const presentations = products.filter((product) => String(product.name) === name).map((product) => String(product.concentration)).filter(Boolean);
        const checked = visibleNames.includes(name);
        return <div
          key={name}
          className={`${checked ? "visible" : "hidden"}${draggingName === name ? " dragging" : ""}`}
          draggable
          onDragStart={(event) => { setDraggingName(name); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", name); }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
          onDrop={(event) => { event.preventDefault(); move(event.dataTransfer.getData("text/plain") || draggingName, name); setDraggingName(""); }}
          onDragEnd={() => setDraggingName("")}
        >
          <i className="catalog-drag-handle" aria-hidden="true">⠿</i>
          <label>
            <input type="checkbox" checked={checked} onChange={() => toggle(name)}/>
            <span><b>{name}</b><small>{presentations.join(" · ") || "Sin presentación"}</small></span>
          </label>
          <em>{checked ? "Visible" : "Oculto"}</em>
          <span className="catalog-order-buttons">
            <button type="button" disabled={index === 0} onClick={() => nudge(name, -1)} aria-label={`Subir ${name}`}>↑</button>
            <button type="button" disabled={index === orderedNames.length - 1} onClick={() => nudge(name, 1)} aria-label={`Bajar ${name}`}>↓</button>
          </span>
        </div>;
      })}</div>
      <button className="primary" type="submit">Guardar catálogo público</button>
    </form>;
  }
  function Clients() {
    const alphabetical = [...clients].sort((a, b) =>
      `${String(a.first_name)} ${String(a.last_name)}`.localeCompare(
        `${String(b.first_name)} ${String(b.last_name)}`,
        "es",
        { sensitivity: "base" },
      ),
    );
    return (
      <>
        <PageHead
          eyebrow="RELACIONES"
          title="Clientes"
          action="+ Cliente"
          onAction={() => setModal("Nuevo cliente")}
        />
        <div className="mobile-list roomy">
          {alphabetical.map((c) => (
            <article
              key={String(c.id)}
              onClick={() => {
                setSelected(c);
                setModal("Ficha del cliente");
              }}
            >
              <i className="avatar">{String(c.first_name).slice(0, 1)}</i>
              <div>
                <b>
                  {String(c.first_name)} {String(c.last_name)}
                </b>
                <span>
                  {String(c.code)} · {String(c.phone || "Sin teléfono")}
                </span>
                <small>{Number(c.purchase_count||0)} compra(s) · {money(c.lifetime_value)} · Nivel de lealtad {Number(c.loyalty_discount_pct||0).toFixed(0)}%</small>
              </div>
              <div className="client-row-actions">
                <button className="mini" type="button" onClick={(event)=>{event.stopPropagation();setSelected(c);setModal("Editar cliente")}}>Editar</button>
                <button className="trash-button" type="button" title="Eliminar cliente" aria-label={`Eliminar a ${String(c.first_name)} ${String(c.last_name)}`} onClick={(event)=>{event.stopPropagation();if(confirm(`¿Eliminar a ${String(c.first_name)} ${String(c.last_name)}? Si tiene facturas, quedará archivado para conservar el historial.`))post("deleteClient",{id:c.id})}}><TrashIcon/></button>
              </div>
            </article>
          ))}
        </div>
        {isAdmin && inactiveClients.length > 0 && <>
          <ListTitle title="Clientes inactivos" />
          <div className="mobile-list roomy inactive-clients">
            {[...inactiveClients].sort((a,b)=>`${String(a.first_name)} ${String(a.last_name)}`.localeCompare(`${String(b.first_name)} ${String(b.last_name)}`,"es",{sensitivity:"base"})).map((client)=><article key={String(client.id)}>
              <i className="avatar">{String(client.first_name).slice(0,1)}</i>
              <div><b>{String(client.first_name)} {String(client.last_name)}</b><span>{String(client.code)} · Cliente archivado</span><small>{Number(client.purchase_count||0)} factura(s) históricas</small></div>
              <button type="button" className="trash-button" title="Eliminar cliente" aria-label={`Eliminar definitivamente a ${String(client.first_name)} ${String(client.last_name)}`} onClick={()=>confirm(`¿Eliminar definitivamente a ${String(client.first_name)} ${String(client.last_name)}?`)&&post("deleteInactiveClient",{id:client.id})}><TrashIcon/></button>
            </article>)}
          </div>
        </>}
      </>
    );
  }
  function ClientDetail({client}:{client:Row}) {
    const clientInvoices=invoices.filter(invoice=>Number(invoice.client_id)===Number(client.id)).sort((a,b)=>new Date(String(b.created_at||"")).getTime()-new Date(String(a.created_at||"")).getTime()),invoiceIds=new Set(clientInvoices.map(invoice=>Number(invoice.id))),clientItems=invoiceItems.filter(item=>invoiceIds.has(Number(item.invoice_id))),productTotals=new Map<number,number>();
    for(const item of clientItems)productTotals.set(Number(item.product_id),(productTotals.get(Number(item.product_id))||0)+Number(item.quantity||0));
    const total=clientInvoices.reduce((sum,invoice)=>sum+Number(invoice.total||0),0),paid=clientInvoices.reduce((sum,invoice)=>sum+Number(invoice.paid||0),0),pending=clientInvoices.reduce((sum,invoice)=>sum+Number(invoice.balance||0),0);
    return <section className="client-detail">
      <header><i className="avatar">{String(client.first_name).slice(0,1)}</i><div><h3>{String(client.first_name)} {String(client.last_name)}</h3><span>{String(client.code)} · {String(client.phone||"Sin teléfono")}</span></div><button type="button" onClick={()=>setModal("Editar cliente")}>Editar</button></header>
      <div className="client-detail-metrics"><span><small>Compras</small><b>{clientInvoices.length}</b></span><span><small>Total facturado</small><b>{money(total)}</b></span><span><small>Total pagado</small><b>{money(paid)}</b></span><span><small>Pendiente</small><b>{money(pending)}</b></span></div>
      <h4>Productos adquiridos</h4>
      <div className="client-product-history">{productTotals.size?[...productTotals.entries()].sort((a,b)=>String(products.find(product=>Number(product.id)===a[0])?.name||"").localeCompare(String(products.find(product=>Number(product.id)===b[0])?.name||""),"es",{sensitivity:"base",numeric:true})).map(([productId,quantity])=><span key={productId}><b>{String(products.find(product=>Number(product.id)===productId)?.name||"Producto")}</b><em>{quantity} unidad(es)</em></span>):<p>Este cliente todavía no tiene productos registrados.</p>}</div>
      <h4>Facturas</h4>
      <div className="client-invoice-history">{clientInvoices.length?clientInvoices.map(invoice=><button type="button" key={String(invoice.id)} onClick={()=>{setSelected(invoice);setModal("Detalle de factura")}}><span><b>{String(invoice.number)}</b><small>{String(invoice.created_at||"").slice(0,10)} · {String(invoice.status)}</small></span><strong>{money(invoice.total)}</strong></button>):<p>No hay facturas registradas para este cliente.</p>}</div>
    </section>;
  }
  function Loyalty(){
    const setting=(key:string,fallback:string)=>String(settings.find(x=>String(x.key)===key)?.value??fallback);
    return <><PageHead eyebrow="FIDELIZACIÓN" title="Programa de lealtad"/><LoyaltySettings values={{enabled:setting("lealtad_activa","1")}}/><ListTitle title="Ranking por compras"/><div className="mobile-list roomy loyalty-ledger">{clients.map((c,index)=>{const rewards=loyaltyRewards.filter(reward=>Number(reward.client_id)===Number(c.id)),available=rewards.filter(reward=>String(reward.status)==="earned"),redeemed=rewards.filter(reward=>String(reward.status)==="redeemed");return <article key={String(c.id)}><i className="avatar">{index+1}</i><div><b>{String(c.first_name)} {String(c.last_name)}</b><span>{Number(c.purchase_count||0)} compra(s) · {money(c.lifetime_value)}</span><small>Nivel permanente: {Number(c.loyalty_discount_pct||0).toFixed(0)}% · {Number(c.qualified_referrals||0)} referido(s)</small><small>Premios: {available.length} disponible(s) · {redeemed.length} canjeado(s)</small></div>{isAdmin&&available[0]&&<button className="mini" type="button" onClick={()=>{setSelected({...available[0],client_name:`${String(c.first_name)} ${String(c.last_name)}`});setModal("Canjear premio")}}>Canjear producto</button>}</article>})}</div></>
  }
  function LoyaltySettings({values}:{values:Row}) {
    return <form className="loyalty-settings" onSubmit={e=>{e.preventDefault();const f=val(e.currentTarget);post("saveLoyaltySettings",{...f,enabled:new FormData(e.currentTarget).get("enabled")==="on",cumulative:new FormData(e.currentTarget).get("cumulative")==="on"})}}>
      <div><b>Reglas de lealtad</b><small>1.ª y 2.ª sin descuento; 3.ª: 5%; 7.ª: 15%; desde la 10.ª: 20% fijo. El nivel nunca se reinicia. Por cada 10 clientes referidos, se gana 1 producto gratis.</small></div>
      <label><input name="enabled" type="checkbox" defaultChecked={String(values.enabled)==="1"}/> Activo</label>
      <button>Guardar reglas</button>
    </form>
  }
  function Cash() {
    const matchesRange = (row: Row) =>
      cashRange==="all" || rowMonth(row).startsWith(cashRange==="year" ? cashYear : reportMonth);
    const periodInvoices = invoices.filter(matchesRange);
    const invoicesById = new Map(invoices.map(invoice => [Number(invoice.id), invoice]));
    const periodInvoiceIds = new Set(periodInvoices.map(invoice => Number(invoice.id)));
    const periodCash = cash.filter(matchesRange);
    const periodSales = periodInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const periodCollected = periodInvoices.reduce((sum, invoice) => sum + Number(invoice.paid || 0), 0);
    const periodPending = periodInvoices.reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0);
    const periodUnits = invoiceItems.filter(item => periodInvoiceIds.has(Number(item.invoice_id)))
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const periodCashNet = periodCash.reduce((sum, movement) =>
      sum + (movement.type === "Ingreso" ? Number(movement.amount || 0) : movement.type === "Egreso" ? -Number(movement.amount || 0) : 0), 0);
    const availableYears = [...new Set([...invoices, ...cash].map(row => rowMonth(row).slice(0, 4))
      .filter(year => /^\d{4}$/.test(year)))].sort((a, b) => b.localeCompare(a));
    const rangeLabel = cashRange==="all" ? "Todo el historial" : cashRange==="year" ? cashYear
      : new Intl.DateTimeFormat("es-DO", { month: "long", year: "numeric" }).format(new Date(`${reportMonth}-01T12:00:00`));
    const enteredCash = periodCash.filter(movement => movement.type === "Ingreso" &&
      movement.category === "Cobro factura");
    const currentInvoiceReceipts = enteredCash.filter(movement => periodInvoiceIds.has(Number(movement.invoice_id)));
    const otherInvoiceReceipts = enteredCash.filter(movement => {
      const invoice = invoicesById.get(Number(movement.invoice_id));
      return invoice && rowMonth(invoice) && !matchesRange(invoice);
    });
    const unassignedReceipts = enteredCash.filter(movement => !currentInvoiceReceipts.includes(movement) &&
      !otherInvoiceReceipts.includes(movement));
    const receiptTotal = (rows: Row[]) => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const paymentsByInvoice = new Map<number, Row[]>();
    for (const payment of payments) {
      const invoiceId = Number(payment.invoice_id);
      const history = paymentsByInvoice.get(invoiceId) ?? [];
      history.push(payment);
      paymentsByInvoice.set(invoiceId, history);
    }
    const reportDate = (row?: Row) => String(row?.created_at || row?.updated_at || "").slice(0, 10) || "—";
    const invoiceDetails = (label: string, value: number, field: "total" | "paid" | "balance") => {
      const rows = periodInvoices.filter(invoice => field === "total" || Number(invoice[field]) > 0);
      return (
        <details className="metric cash-detail">
          <summary><span>{label}</span><b>{money(value)}</b></summary>
          {rows.length ? <ul>{rows.map(invoice => (
            <li key={String(invoice.id)}>
              <strong>{String(invoice.number || "Factura")}</strong>
              <span>Venta {reportDate(invoice)} · {money(invoice[field])}</span>
              {paymentsByInvoice.get(Number(invoice.id))?.map(payment => (
                <small key={String(payment.id)}>Cobro {reportDate(payment)} · {money(payment.applied_usd)}</small>
              ))}
            </li>
          ))}</ul> : <small>Sin facturas para este total.</small>}
        </details>
      );
    };
    const receiptDetails = (label: string, rows: Row[]) => (
      <details className="metric cash-detail">
        <summary><span>{label}</span><b>{money(receiptTotal(rows))}</b></summary>
        {rows.length ? <ul>{rows.map(movement => {
          const invoice = invoicesById.get(Number(movement.invoice_id));
          return (
            <li key={String(movement.id)}>
              <strong>{String(invoice?.number || movement.category)}</strong>
              <span>Venta {reportDate(invoice)} · Entrada a Caja {reportDate(movement)}</span>
              <small>{money(movement.amount)}</small>
            </li>
          );
        })}</ul> : <small>Sin cobros para este total.</small>}
      </details>
    );
    const canDeleteCash = (movement: Row) => isAdmin && !movement.invoice_id && !movement.withdrawal_id && !movement.purchase_id && !["Pago a Peptibra pendiente", "Pago de vendedor a Peptibra"].includes(String(movement.category));
    const deletableCashIds = periodCash.filter(canDeleteCash).map((movement) => Number(movement.id));
    const [selectedCashIds, setSelectedCashIds] = useState<number[]>([]);
    const toggleCash = (id: number) => setSelectedCashIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    const allCashSelected = deletableCashIds.length > 0 && deletableCashIds.every((id) => selectedCashIds.includes(id));
    return (
      <>
        <PageHead
          eyebrow="FINANZAS"
          title="Caja e insights"
          action="+ Movimiento"
          onAction={() => setModal("Movimiento de caja")}
        />
        <section className="cash-period-filter" aria-label="Filtrar finanzas">
          <div className="cash-range-tabs">
            <button type="button" className={cashRange==="month"?"active":""} onClick={()=>setCashRange("month")}>Por mes</button>
            <button type="button" className={cashRange==="year"?"active":""} onClick={()=>setCashRange("year")}>Por año</button>
            <button type="button" className={cashRange==="all"?"active":""} onClick={()=>setCashRange("all")}>Todo</button>
          </div>
          {cashRange==="month"&&<label>Mes y año<input type="month" value={reportMonth} max={currentMonthValue()} onChange={event=>setReportMonth(event.target.value||currentMonthValue())}/></label>}
          {cashRange==="year"&&<label>Año<select value={cashYear} onChange={event=>setCashYear(event.target.value)}>{availableYears.map(year=><option key={year}>{year}</option>)}</select></label>}
          <strong>{rangeLabel}</strong>
        </section>
        <div className="cash-hero">
          <span>Ventas totales · {rangeLabel}</span>
          <b>{money(periodSales)}</b>
          <small>{periodInvoices.length} factura(s) · Todos los importes están expresados en USD</small>
          <button onClick={() => window.location.assign("/ptbr-mobile/cash")}>
            Imprimir / Guardar PDF
          </button>
        </div>
        <div className="mobile-metrics cash-period-metrics">
          {invoiceDetails("Detalle de ventas", periodSales, "total")}
          {invoiceDetails("Cobrado de esas ventas", periodCollected, "paid")}
          {invoiceDetails("Pendiente de esas ventas", periodPending, "balance")}
          <Card label="Unidades vendidas" value={String(periodUnits)} tone="blue" />
          <Card label="Flujo neto de movimientos" value={money(periodCashNet)} />
        </div>
        <ListTitle title={`Cobros de facturas ingresados a Caja · ${rangeLabel}`} />
        <div className="mobile-metrics cash-period-metrics">
          {receiptDetails("Total ingresado por cobros", enteredCash)}
          {receiptDetails("De facturas del período", currentInvoiceReceipts)}
          {receiptDetails("De facturas de otros períodos", otherInvoiceReceipts)}
          {unassignedReceipts.length > 0 && receiptDetails("Sin factura o período identificado", unassignedReceipts)}
        </div>
        <p className="cash-explanation">Las entregas de vendedores y los demás movimientos se consultan en el flujo neto de movimientos.</p>
        <ListTitle title="Indicadores financieros generales" />
        <div className="mobile-metrics cash-metrics">
          <Card
            label={`Recomendación para reponer (${retention.toFixed(0)}%)`}
            value={money(retained)}
            tone="amber"
          />
          <Card
            label="Dinero puesto por socios"
            value={money(
              partnerBalances.reduce((s, x) => s + Math.max(0, x.amount), 0),
            )}
          />
          <Card
            label="Ganancia cobrada"
            value={money(netProfit)}
            tone="blue"
          />
          <Card
            label="Ganancias disponibles"
            value={money(distributable)}
            tone="green"
          />
        </div>
        <div className="cash-explanation">
          Sugerencia: reservar {retention.toFixed(1)}% de la ganancia cobrada
          para reponer inventario. Este monto es orientativo y no se descuenta
          ni se aparta automáticamente. · Proveedores pendientes {money(supplierDue)}.
        </div>
        <ListTitle title="Dinero pendiente por socio" />
        <div className="partner-bars">
          {partnerBalances.map((x) => (
            <div key={String(x.partner.id)}>
              <span>{String(x.partner.name)}</span>
              <i>
                <b
                  style={{
                    width: `${Math.min(100, (x.amount / Math.max(1, ...partnerBalances.map((y) => y.amount))) * 100)}%`,
                  }}
                />
              </i>
              <strong>{money(x.amount)}</strong>
            </div>
          ))}
        </div>
        <ListTitle title={`Movimientos · ${rangeLabel}`} />
        {deletableCashIds.length > 0 && <div className="cash-bulk-toolbar">
          <label><input type="checkbox" checked={allCashSelected} onChange={() => setSelectedCashIds(allCashSelected ? [] : deletableCashIds)} /> Seleccionar todos los borrables</label>
          <span>{selectedCashIds.length} seleccionado(s)</span>
          <button type="button" className="trash-button batch-trash" title="Eliminar movimientos seleccionados" aria-label="Eliminar movimientos seleccionados" disabled={!selectedCashIds.length} onClick={() => { if (confirm(`¿Eliminar definitivamente ${selectedCashIds.length} movimiento(s) seleccionado(s)?`)) post("deleteCashMovements", { ids: selectedCashIds }); }}><TrashIcon/><b>{selectedCashIds.length}</b></button>
        </div>}
        <div className="mobile-list roomy">
          {periodCash.map((m) => (
            <article key={String(m.id)}>
              {canDeleteCash(m) && <label className="cash-row-check" title="Seleccionar para eliminar"><input type="checkbox" checked={selectedCashIds.includes(Number(m.id))} onChange={() => toggleCash(Number(m.id))} /><span className="sr-only">Seleccionar movimiento</span></label>}
              <i className={m.type === "Ingreso" ? "cash-in" : "cash-out"}>
                {m.type === "Ingreso" ? "↓" : "↑"}
              </i>
              <div>
                <b>{String(m.category)}</b>
                <span>{String(m.notes || m.partner_name || "")}</span>
              </div>
              <div className="right">
                <b className={m.type === "Ingreso" ? "green" : ""}>
                  {m.type === "Ingreso" ? "+" : m.type === "Egreso" ? "−" : "≈"}
                  {money(m.amount)}
                </b>
                <small>{String(m.created_at).slice(0, 10)}</small>
                {isAdmin && String(m.category) === "Pago a Peptibra pendiente" && (
                  <button className="mini" onClick={() => post("confirmPeptibraPayment", { id: m.id })}>
                    Confirmar recibido
                  </button>
                )}
              </div>
            </article>
          ))}
          {!periodCash.length&&<div className="empty-state">No hay movimientos en este período.</div>}
        </div>
      </>
    );
  }
  function Protocols() {
    return (
      <>
        <PageHead eyebrow="DOCUMENTOS" title="Protocolos" action="+ Nuevo protocolo" onAction={() => {setSelected(null);setModal("Nuevo protocolo")}} />
        <p className="page-intro">Abre un protocolo para imprimirlo, guardarlo como PDF o compartirlo. Solo puedes modificar los protocolos creados por tu propia cuenta.</p>
        <div className="mobile-list roomy">
          {protocols.map((p) => (
            <article
              className="protocol-list-row"
              key={String(p.id)}
              onClick={() => window.location.assign(`/ptbr-mobile/protocols/${p.id}`)}
            >
              <div>
                <b>{String(p.name)}</b>
                <span>{String(products.find((x) => x.id === p.product_id)?.name || "")}</span>
              </div>
              <div className="protocol-row-actions">
                <button type="button" className="protocol-open" onClick={(event) => { event.stopPropagation(); window.location.assign(`/ptbr-mobile/protocols/${p.id}`); }}>Abrir</button>
                {Boolean(p.can_edit) && <button type="button" onClick={(event) => { event.stopPropagation(); setSelected(p); setModal("Editar protocolo"); }}>Editar</button>}
                {Boolean(p.can_delete) && <button type="button" className="trash-button" title="Eliminar protocolo" aria-label={`Eliminar protocolo ${String(p.name)}`} onClick={(event) => { event.stopPropagation(); if (confirm(`¿Eliminar definitivamente el protocolo “${String(p.name)}”?`)) post("deleteProtocol", { id: p.id }); }}><TrashIcon/></button>}
              </div>
            </article>
          ))}
          {!protocols.length && <p className="empty-state">No hay protocolos disponibles todavía.</p>}
        </div>
      </>
    );
  }
  function More() {
    return (
      <>
        <PageHead eyebrow="HERRAMIENTAS" title="Más módulos" />
        <div className="more-grid">
          <Module
            title="Equipo"
            count={team.length}
            action={() => setModal("Nuevo integrante")}
          />
          <Module
            title="Proveedores"
            count={suppliers.length}
            action={() => setModal("Nuevo proveedor")}
          />
          <Module
            title="Compras"
            count={purchases.length}
            action={() => setModal("Nueva compra")}
          />
          <Module
            title="Retiros / promoción"
            count={internalWithdrawals.length}
            action={() => setModal("Nuevo retiro")}
          />
          <Module
            title="BAC Lab"
            count={0}
            action={() => setModal("BAC Lab")}
          />
          <Module
            title="Auditoría"
            count={auditLog.length}
            action={() => setModal("Auditoría")}
          />
          <Module
            title="Configuración"
            count={0}
            action={() =>
              post("saveSetting", {
                key: "last_mobile_access",
                value: new Date().toISOString(),
              })
            }
          />
        </div>
        <ListTitle title="Retiros y promoción" />
        <div className="mobile-list roomy">
          {internalWithdrawals.map((w) => {
            const member = team.find((x) => x.id === w.team_member_id),
              product = products.find((x) => x.id === w.product_id);
            return (
              <article
                key={String(w.id)}
                onClick={() => {
                  setSelected(w);
                  setModal("Pagar retiro");
                }}
              >
                <div>
                  <b>
                    {String(member?.name || "Socio")} ·{" "}
                    {String(product?.name || "Producto")}
                  </b>
                  <span>
                    {String(w.type)} · {String(w.quantity)} unidad(es)
                  </span>
                </div>
                <div className="right">
                  <b>{money(w.balance)}</b>
                  <small>{String(w.status)}</small>
                </div>
              </article>
            );
          })}
        </div>
        <ListTitle title="Equipo" />
        <div className="mobile-list">
          {team.map((t) => (
            <article
              key={String(t.id)}
              onClick={() => {
                setSelected(t);
                setModal("Editar integrante");
              }}
            >
              <div>
                <b>{String(t.name)}</b>
                <span>
                  {String(t.role)}
                  {t.partner_name ? ` · ${String(t.partner_name)}` : ""}
                </span>
                {String(t.role)==="Vendedor"&&<small>Ventas {money(t.sales_total)} · Cobradas {money(t.sales_collected)} · Por cobrar {money(t.sales_pending)}</small>}
              </div>
              <div className="right">
                <b>{Number(t.commission).toFixed(1)}%</b>
                <small>{String(t.role)==="Vendedor"?`${money(t.commission_due)} por pagar · ${money(t.commission_pending_collection)} pendiente del cliente`:"comisión"}</small>
              </div>
            </article>
          ))}
        </div>
        <ListTitle title="Proveedores" />
        <div className="mobile-list">
          {suppliers.map((s) => (
            <article
              key={String(s.id)}
              onClick={() => {
                setSelected(s);
                setModal("Editar proveedor");
              }}
            >
              <div>
                <b>{String(s.name)}</b>
                <span>{String(s.phone || "Sin teléfono")}</span>
              </div>
            </article>
          ))}
        </div>
        <ListTitle title="Compras" />
        <div className="mobile-list">
          {purchases.map((p) => (
            <article
              key={String(p.id)}
              onClick={() => {
                setSelected(p);
                setModal("Editar compra");
              }}
            >
              <div>
                <b>{String(p.concept)}</b>
                <span>{String(p.supplier_name)}</span>
              </div>
              <div className="right">
                <b>{money(p.total)}</b>
                <small>Pendiente {money(p.balance)}</small>
              </div>
            </article>
          ))}
        </div>
      </>
    );
  }
  function InventoryLotsForm({product}:{product:Row}) {
    const lots=inventoryLots.filter(lot=>Number(lot.product_id)===Number(product.id)&&String(lot.location)===inventoryLocation).sort((a,b)=>String(a.expires_at||"9999").localeCompare(String(b.expires_at||"9999"))||String(a.created_at).localeCompare(String(b.created_at)));
    return <section className="lot-manager">
      <header><div><small>PRODUCTO</small><h3>{String(product.name)} {String(product.concentration)}</h3></div><b>{lots.reduce((sum,lot)=>sum+Number(lot.available_quantity||0),0)} unidades trazadas</b></header>
      <form className="mobile-form" onSubmit={event=>{event.preventDefault();post("saveInventoryLot",{...val(event.currentTarget),productId:product.id})}}>
        <div className="form-pair"><Field name="lotNumber" label="Número de lote" required/><Field name="quantity" label="Cantidad recibida" type="number" required/></div>
        <div className="form-pair"><Field name="manufacturedAt" label="Fecha de fabricación" type="date"/><Field name="expiresAt" label="Fecha de vencimiento" type="date"/></div>
        <div className="form-pair"><Field name="unitCost" label="Costo unitario" type="number"/><Select name="supplierId" label="Proveedor" items={suppliers} render={supplier=>String(supplier.name)} optional/></div>
        <Field name="coaUrl" label="Enlace del COA" type="url"/><Field name="notes" label="Notas"/>
        <button>Recibir lote y sumar inventario</button>
      </form>
      <div className="lot-list">{lots.map(lot=><article key={String(lot.id)}><div><b>Lote {String(lot.lot_number)}</b><span>Disponible {String(lot.available_quantity)} de {String(lot.received_quantity)}</span><small>{lot.expires_at?`Vence ${String(lot.expires_at)}`:"Sin vencimiento registrado"}</small></div><div>{Boolean(lot.coa_url)&&<a href={String(lot.coa_url)} target="_blank" rel="noreferrer">Ver COA</a>}<strong>{String(lot.status)}</strong></div></article>)}{!lots.length&&<p>No hay lotes registrados para esta presentación.</p>}</div>
    </section>;
  }
  function RewardRedemptionForm({reward}:{reward:Row}) {
    return <form className="mobile-form reward-redemption" onSubmit={event=>{event.preventDefault();post("redeemReferralReward",{...val(event.currentTarget),rewardId:reward.id})}}>
      <p><b>{String(reward.client_name)}</b> utilizará el premio correspondiente a sus referidos. El canje quedará guardado en la auditoría.</p>
      <Select name="productId" label="Producto entregado" items={alphabeticalProducts} render={product=>`${String(product.name)} · ${String(product.concentration)}`}/>
      <Field name="invoiceId" label="Factura relacionada (opcional)" type="number"/>
      <Field name="notes" label="Notas del canje"/>
      <button>Confirmar canje</button>
    </form>;
  }
  function AuditLog() {
    const label=(entry:Row)=>({create:"Creó",update:"Editó",delete:"Eliminó",adjust:"Ajustó",payment:"Registró pago",redeem:"Canjeó",restore:"Restauró"}[String(entry.action)]||String(entry.action));
    return <section className="audit-log"><p>Registro de las operaciones sensibles más recientes. Este historial no se modifica desde la interfaz.</p><div>{auditLog.map(entry=><article key={String(entry.id)}><div><b>{label(entry)} · {String(entry.entity_type)}</b><span>{String(entry.actor_email||entry.actor_id)}</span></div><div><strong>#{String(entry.entity_id||"—")}</strong><small>{new Date(String(entry.created_at)).toLocaleString("es-DO")}</small></div></article>)}{!auditLog.length&&<p>No hay eventos auditados todavía.</p>}</div></section>;
  }
  async function pay(i: Row) {
    setSelected(i);
    setModal("Aplicar pago");
  }
  function submit(action: string) {
    return (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      post(action, val(e.currentTarget));
    };
  }
  function ProductForm({ initial }: { initial: Row | null }) {
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [savingProduct, setSavingProduct] = useState(false);
    const [productError, setProductError] = useState("");
    const concentrations = [5, 10, 15, 20, 30, 40, 50, 100];
    const mgOf = (value: unknown) =>
      Number(
        String(value || "").match(
          /(?:^|\D)(5|10|15|20|30|40|50|100)\s*mg\b/i,
        )?.[1] || 0,
      );
    const family = initial
      ? products.filter(
          (x) =>
            String(x.name).trim().toLowerCase() ===
            String(initial.name).trim().toLowerCase(),
        )
      : [];
    const defaultComplement = products.find((product) => /bac water|bacteriost/i.test(String(product.name)) && /3\s*ml/i.test(String(product.concentration))) || products.find((product) => /bac water|bacteriost/i.test(String(product.name)));
    const variantByMg = new Map(family.map((x) => [mgOf(x.concentration), x]));
    const otherVariant =
      initial && !mgOf(initial.concentration) ? initial : null;
    return (
      <>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (savingProduct) return;
            setSavingProduct(true);
            setProductError("");
            try {
              const formValues = val(e.currentTarget);
              delete formValues.photo;
              const response = await fetch("/api/mobile", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  action: "saveProductFamily",
                  data: {
                    ...formValues,
                    id: initial?.id,
                    oldName: initial?.name,
                  },
                }),
              });
              const result = await response.json();
              if (!response.ok) {
                setProductError(result.error || "No se pudo guardar el producto");
                return;
              }
              if (photoFile && result.id) {
                const photoData = new FormData();
                photoData.set("productId", String(result.id));
                photoData.set("file", photoFile);
                const photoResponse = await fetch("/api/mobile/upload", {
                  method: "POST",
                  body: photoData,
                });
                const photoResult = await photoResponse.json();
                if (!photoResponse.ok) {
                  setProductError(
                    `El producto se guardó, pero la fotografía no pudo subirse: ${photoResult.error || "error desconocido"}`,
                  );
                  await load();
                  return;
                }
              } else {
                await fetch("/api/mobile", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ action: "touchRevision", data: {} }),
                });
              }
              setModal(null);
              setSelected(null);
              await load();
            } catch {
              setProductError("No se pudo conectar para guardar el producto. Intenta nuevamente.");
            } finally {
              setSavingProduct(false);
            }
          }}
          className="mobile-form"
        >
          <Field name="name" label="Nombre" required value={initial?.name} />
          <Field
            name="publicName"
            label="Nombre público"
            value={initial?.public_name || initial?.name}
          />
          <small>
            El nombre interno se usa en inventario, facturas y lista de precios.
            El nombre público es el que verán los clientes en el sitio web.
          </small>
          <div className="auto-sku-note">
            <b>SKU automático</b>
            <small>El sistema asignará un código único con el prefijo PTBR-.</small>
          </div>
          <Field
            name="description"
            label="Descripción"
            value={initial?.description}
          />
          <small>
            Define por presentación el precio y el costo base total: péptido,
            vial, etiqueta, empaque y demás. El Agua BAC se calcula aparte.
          </small>
          <div className="presentation-price-grid">
            {concentrations.map((mg) => (
              <div key={mg} className="presentation-cost-card">
                <b>{mg} mg</b>
                <Field
                  name={`price${mg}`}
                  label="Precio"
                  type="number"
                  value={
                    variantByMg.get(mg)?.normal_price ||
                    variantByMg.get(mg)?.price
                  }
                />
                <Field
                  name={`cost${mg}`}
                  label="Costo base total"
                  type="number"
                  value={variantByMg.get(mg)?.unit_cost}
                />
              </div>
            ))}
          </div>
          <div className="form-pair">
            <Field
              name="otherPresentation"
              label="Otra presentación / volumen"
              value={otherVariant?.concentration}
            />
            <Field
              name="otherPrice"
              label="Precio"
              type="number"
              value={otherVariant?.normal_price || otherVariant?.price}
            />
          </div>
          <Field
            name="otherCost"
            label="Costo base total de esa presentación"
            type="number"
            value={otherVariant?.unit_cost}
          />
          <Field
            name="wholesaleMgPrice"
            label="Precio por mg al por mayor"
            type="number"
            value={initial?.wholesale_mg_price}
          />
          <Field
            name="wholesaleMinimum"
            label="Mínimo al por mayor"
            type="number"
            value={initial?.wholesale_minimum}
          />
          <div className="product-complement-rule">
            <label className="checkline">
              <input
                name="complementEnabled"
                type="checkbox"
                defaultChecked={Boolean(initial?.complement_enabled ?? true)}
              />
              Este producto necesita un producto complementario
            </label>
            <div className="form-pair">
              <label>
                Producto complementario
                <select name="complementProductId" defaultValue={String(initial?.complement_product_id || defaultComplement?.id || "")}>
                  <option value="">Seleccionar</option>
                  {products.filter((product) => Number(product.id) !== Number(initial?.id)).sort((a,b)=>`${String(a.name)} ${String(a.concentration)}`.localeCompare(`${String(b.name)} ${String(b.concentration)}`,"es",{sensitivity:"base"})).map((product)=><option key={String(product.id)} value={String(product.id)}>{String(product.name)} {String(product.concentration)}</option>)}
                </select>
              </label>
              <Field name="complementQuantity" label="Cantidad por unidad vendida" type="number" value={initial?.complement_quantity || 1} />
            </div>
            <small>Ejemplo: cada vial de péptido puede requerir 1 Agua BAC de 3 ml. Puedes desactivar esta regla para plumas u otros productos.</small>
          </div>
          <label className="product-photo-field">
            Fotografía del producto
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
            />
            <small>
              {photoFile
                ? photoFile.name
                : initial?.photo_key
                  ? "Se conservará la fotografía actual si no eliges otra."
                  : "JPG, PNG, WebP o GIF · máximo 8 MB. Se aplicará a todas las presentaciones."}
            </small>
          </label>
          {productError && <div className="product-form-error">{productError}</div>}
          <button disabled={savingProduct}>
            {savingProduct ? "Guardando…" : "Guardar producto y presentaciones"}
          </button>
          {initial && (
            <>
              <button
                type="button"
                className="danger"
                onClick={() =>
                  confirm("¿Archivar solo esta presentación?") &&
                  post("archive", { entity: "product", id: initial.id })
                }
              >
                Archivar esta presentación
              </button>
            </>
          )}
        </form>
      </>
    );
  }
  function ClientForm({ initial }: { initial: Row | null }) {
    const [fixedDiscountPct,setFixedDiscountPct]=useState(String(initial?.fixed_discount_pct||""));
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          post("saveClient", { ...val(e.currentTarget), loyaltyEnabled:new FormData(e.currentTarget).get("loyaltyEnabled")==="on", id: initial?.id });
        }}
        className="mobile-form"
      >
        <Field
          name="firstName"
          label="Nombre"
          required
          value={initial?.first_name}
        />
        <Field name="lastName" label="Apellido" value={initial?.last_name} />
        <Field name="phone" label="Teléfono" value={initial?.phone} />
        <label>Referido por<select name="referredByClientId" defaultValue={String(initial?.referred_by_client_id||"")}><option value="">Sin referido</option>{clients.filter(c=>c.id!==initial?.id).map(c=><option key={String(c.id)} value={String(c.id)}>{String(c.code)} · {String(c.first_name)} {String(c.last_name)}</option>)}</select></label>
        <label>Descuento fijo exclusivo (%)<input name="fixedDiscountPct" type="number" min="0" max="100" step="any" value={fixedDiscountPct} placeholder="0" onChange={event=>setFixedDiscountPct(event.target.value)}/><small>Se aplicará automáticamente al facturar a este cliente y sustituirá el descuento de lealtad.</small></label>
        <label className="check-row"><input name="loyaltyEnabled" type="checkbox" defaultChecked={initial?.loyalty_enabled===undefined||Number(initial?.loyalty_enabled)===1}/> Participa en el programa de lealtad</label>
        <button>Guardar cliente</button>
        {initial && isAdmin && (
          <button
            type="button"
            className="danger"
            onClick={() =>
              confirm("¿Archivar este cliente?") &&
              post("archive", { entity: "client", id: initial.id })
            }
          >
            Archivar cliente
          </button>
        )}
      </form>
    );
  }
  function InvoiceForm({ initial }: { initial: Row | null }) {
    const starting = initial
        ? invoiceItems
            .filter((x) => x.invoice_id === initial.id)
            .map((x) => ({
              ...x,
              productId: x.product_id,
              unitPrice: x.unit_price,
              unitCost: x.unit_cost,
              name:
                products.find((p) => p.id === x.product_id)?.name || "Producto",
            }))
        : [],
      [cart, setCart] = useState<Row[]>(starting),
      [product, setProduct] = useState(""),
      [sellerId, setSellerId] = useState(String(initial?.seller_id || (!isAdmin ? access.teamId || "" : ""))),
      [quantity, setQuantity] = useState("1"),
      [clientId, setClientId] = useState(String(initial?.client_id || "")),
      [clientSearch, setClientSearch] = useState(() => {
        const client = clients.find((item) => String(item.id) === String(initial?.client_id || ""));
        return client ? `${String(client.first_name)} ${String(client.last_name)} · ${String(client.code)}` : "";
      }),
      [quickOpen, setQuickOpen] = useState(false),
      [quickFirst, setQuickFirst] = useState(""),
      [quickLast, setQuickLast] = useState(""),
      [quickPhone, setQuickPhone] = useState(""),
      [quickClient, setQuickClient] = useState<Row | null>(null),
      [savingClient, setSavingClient] = useState(false),
      [manualDiscountType, setManualDiscountType] = useState(String(initial?.manual_discount_type || "Porcentaje")),
      [manualDiscountValue, setManualDiscountValue] = useState(() => initial ? String(Number(initial.manual_discount_value || 0)) : ""),
      [penPromptOpen, setPenPromptOpen] = useState(false),
      [skipPenPrompt, setSkipPenPrompt] = useState(false);
    const chosen = products.find((p) => String(p.id) === product),
      seller = team.find((x) => String(x.id) === sellerId),
      available = balances
        .filter(
          (x) =>
            String(x.product_id) === product &&
            String(x.location) === `VENDEDOR:${sellerId}`,
        )
        .reduce((s, x) => s + Number(x.quantity || 0), 0),
      selectedClient=clients.find(c=>String(c.id)===clientId),fixedDiscountRate=Number(selectedClient?.fixed_discount_pct||0),loyaltyRate=fixedDiscountRate>0?0:Number(initial?.loyalty_discount_pct||selectedClient?.loyalty_next_discount_pct||0),invoiceRate=Number(initial?.invoice_exchange_rate||currentExchangeRate.rate||60),
      previewLines=cart.map(item=>{const itemProduct=products.find(candidate=>Number(candidate.id)===Number(item.productId)),qty=Math.max(1,Number(item.quantity)||1),match=String(itemProduct?.concentration||"").match(/(\d+(?:[.,]\d+)?)\s*mg/i),wholesaleRate=Number(itemProduct?.wholesale_mg_price||0),wholesaleMinimum=Number(itemProduct?.wholesale_minimum||0),wholesale=Boolean(match&&wholesaleRate>0&&wholesaleMinimum>0&&qty>=wholesaleMinimum),unitPrice=wholesale&&match?wholesaleRate*Number(match[1].replace(",",".")):Number(item.unitPrice||0);return{...item,qty,unitPrice,itemProduct}}),
      gross=previewLines.reduce((sum,item)=>sum+item.qty*item.unitPrice,0),fixedDiscount=gross*Math.max(0,fixedDiscountRate)/100,afterFixed=Math.max(0,gross-fixedDiscount),manualValue=Math.max(0,Number(manualDiscountValue)||0),manualDiscount=Math.min(afterFixed,manualDiscountType==="Monto"?manualValue:afterFixed*manualValue/100),afterManual=Math.max(0,afterFixed-manualDiscount),automaticLoyalty=manualValue<=.005&&fixedDiscountRate<=.005&&loyaltyRate>0,loyaltyDiscount=automaticLoyalty?afterManual*loyaltyRate/100:0,totalBeforeBac=Math.max(0,afterManual-loyaltyDiscount),
      isBacProduct=(candidate:Row|undefined)=>Boolean(candidate&&/bac water|bacteriost/i.test(`${String(candidate.name||"")} ${String(candidate.category||"")}`)),isPenProduct=(candidate:Row|undefined)=>Boolean(candidate&&/\bpen\b|pluma|prellenad|pre-filled/i.test(`${String(candidate.name||"")} ${String(candidate.category||"")} ${String(candidate.concentration||"")}`)),containsInjectable=previewLines.some(item=>Boolean(item.itemProduct?.complement_enabled)),containsPen=previewLines.some(item=>isPenProduct(item.itemProduct)),complementRequired=previewLines.reduce((map,item)=>{const complementId=Number(item.itemProduct?.complement_product_id||0),perUnit=Math.max(1,Number(item.itemProduct?.complement_quantity||1));if(item.itemProduct?.complement_enabled&&complementId)map.set(complementId,(map.get(complementId)||0)+item.qty*perUnit);return map},new Map<number,number>()),missingComplements=[...complementRequired].map(([complementId,required])=>{const complement=products.find(candidate=>Number(candidate.id)===complementId),existing=previewLines.filter(item=>Number(item.itemProduct?.id)===complementId).reduce((sum,item)=>sum+item.qty,0);return{product:complement,quantity:Math.max(0,required-existing)}}).filter(item=>item.product&&item.quantity>0),missingBac=missingComplements.filter(item=>isBacProduct(item.product)).reduce((sum,item)=>sum+item.quantity,0),freeBac=Boolean(bacRules.enabled)&&totalBeforeBac>Number(bacRules.threshold||200),autoBacSubtotal=0,previewTotal=Math.max(0,afterManual-loyaltyDiscount),previewDiscount=gross-previewTotal,previewDop=Math.round(previewTotal*invoiceRate/5)*5,availablePens=products.filter(candidate=>isPenProduct(candidate)&&stock(candidate.id)>0).sort((a,b)=>String(a.name).localeCompare(String(b.name),"es",{sensitivity:"base"}));
    const createQuickClient = async () => {
      if (!quickFirst.trim()) {
        setError("Escribe el nombre del cliente");
        return;
      }
      setSavingClient(true);
      const response = await fetch("/api/mobile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "saveClient",
          data: {
            firstName: quickFirst,
            lastName: quickLast,
            phone: quickPhone,
          },
        }),
      });
      const result = await response.json();
      setSavingClient(false);
      if (!response.ok) {
        setError(result.error || "No se pudo crear el cliente");
        return;
      }
      const created = {
        id: result.id,
        code: result.code,
        first_name: quickFirst,
        last_name: quickLast,
        phone: quickPhone,
      };
      setQuickClient(created);
      setClientId(String(result.id));
      setClientSearch(`${quickFirst} ${quickLast} · ${String(result.code || "")}`.trim());
      setQuickOpen(false);
    };
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if(containsInjectable&&!containsPen&&availablePens.length&&!skipPenPrompt){setPenPromptOpen(true);return;}
          if(missingComplements.length&&!freeBac){
            const summary=missingComplements.map(item=>`${item.quantity} × ${String(item.product?.name)} ${String(item.product?.concentration||"")}`).join("\n");
            const addComplements=window.confirm(`Este pedido tiene productos complementarios sugeridos:\n\n${summary}\n\nAceptar: agregarlos al pedido.\nCancelar: continuar y guardar sin agregarlos.`);
            if(addComplements){setCart([...cart,...missingComplements.map(item=>({productId:item.product!.id,quantity:item.quantity,unitPrice:item.product!.normal_price||item.product!.price,unitCost:item.product!.unit_cost||0,name:item.product!.name}))]);return;}
          }
          const f = val(e.currentTarget);
          post(initial ? "updateInvoice" : "createInvoice", {
            ...f,
            id: initial?.id,
            number: initial?.number,
            items: cart,
          });
        }}
        className="mobile-form"
      >
        <div className="invoice-client-picker">
          <label>
            Buscar cliente por nombre
            <input
              list="invoice-client-options"
              required
              value={clientSearch}
              placeholder="Escribe el nombre del cliente"
              onChange={(event) => {
                const value = event.target.value;
                setClientSearch(value);
                const pool = quickClient ? [...clients, quickClient] : clients;
                const match = pool.find((client) => `${String(client.first_name)} ${String(client.last_name)} · ${String(client.code)}` === value);
                setClientId(match ? String(match.id) : "");
              }}
            />
            <input type="hidden" name="clientId" value={clientId} />
            <datalist id="invoice-client-options">
              {[...clients, ...(quickClient ? [quickClient] : [])]
                .sort((a, b) => `${String(a.first_name)} ${String(a.last_name)}`.localeCompare(`${String(b.first_name)} ${String(b.last_name)}`, "es", { sensitivity: "base" }))
                .map((client) => <option key={String(client.id)} value={`${String(client.first_name)} ${String(client.last_name)} · ${String(client.code)}`} />)}
            </datalist>
          </label>
          <button
            type="button"
            className="new-client-inline"
            onClick={() => setQuickOpen((open) => !open)}
          >
            {quickOpen ? "Cancelar" : "＋ Nuevo cliente"}
          </button>
        </div>
        {quickOpen && (
          <div className="quick-client-box">
            <b>Crear cliente sin salir de la factura</b>
            <input aria-label="Nombre" placeholder="Nombre *" value={quickFirst} onChange={(event) => setQuickFirst(event.target.value)} />
            <input aria-label="Apellido" placeholder="Apellido" value={quickLast} onChange={(event) => setQuickLast(event.target.value)} />
            <input aria-label="Teléfono" placeholder="Teléfono" value={quickPhone} onChange={(event) => setQuickPhone(event.target.value)} />
            <button type="button" disabled={savingClient} onClick={createQuickClient}>
              {savingClient ? "Guardando…" : "Crear y seleccionar"}
            </button>
          </div>
        )}
        <label>
          Vendedor / socio
          <select
            name="sellerId"
            required
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
          >
            <option value="">Seleccionar</option>
            {team.map((x) => (
              <option key={String(x.id)} value={String(x.id)}>
                {String(x.name)}
              </option>
            ))}
          </select>
          <small>
            Descuento manual permitido: hasta{" "}
            {Number(seller?.max_discount || 0).toFixed(2)}%
          </small>
        </label>
        <div className="cart-add">
          <select value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="">Producto</option>
            {alphabeticalProducts.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {String(p.name)} {String(p.concentration)}
              </option>
            ))}
          </select>
          <label>
            Cantidad
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onBlur={() => { if (!quantity || Number(quantity) < 1) setQuantity("1"); }}
            />
            <small>
              {product && sellerId
                ? `${available} en stock`
                : "Selecciona producto y vendedor"}
            </small>
          </label>
          <button
            type="button"
            onClick={() =>
              chosen &&
              setCart([
                ...cart,
                {
                  productId: chosen.id,
                  quantity: Math.max(1, Number(quantity) || 1),
                  unitPrice: chosen.normal_price || chosen.price,
                  unitCost: chosen.unit_cost || 0,
                  name: chosen.name,
                },
              ])
            }
          >
            Agregar
          </button>
        </div>
        {cart.map((x, n) => (
          <div className="cart-row" key={n}>
            <span>{String(x.name)}</span>
            <input
              type="number"
              min="1"
              value={String(x.quantity ?? "")}
              onChange={(e) =>
                setCart(
                  cart.map((y, k) =>
                    k === n ? { ...y, quantity: e.target.value } : y,
                  ),
                )
              }
              onBlur={() => setCart(cart.map((y,k)=>k===n&&(!String(y.quantity||"")||Number(y.quantity)<1)?{...y,quantity:"1"}:y))}
            />
            <b>{money(Number(x.quantity) * Number(x.unitPrice))}</b>
            <button
              type="button"
              onClick={() => setCart(cart.filter((_, k) => k !== n))}
            >
              ×
            </button>
          </div>
        ))}
        <div className="form-summary">
          <span>Subtotal estimado</span><b>{money(gross + autoBacSubtotal)}</b>
          {fixedDiscount>0&&<><span>Descuento fijo del cliente ({fixedDiscountRate.toFixed(2).replace(/\.00$/,"")}%)</span><b>-{money(fixedDiscount)}</b></>}
          {manualDiscount>0&&<><span>Descuento manual</span><b>-{money(manualDiscount)}</b></>}
          {loyaltyDiscount>0&&<><span>Descuento de lealtad automático</span><b>-{money(loyaltyDiscount)}</b></>}
          {missingComplements.length>0&&<><span>Complementos sugeridos</span><b>{freeBac&&missingBac>0?`${missingBac} Agua BAC sin costo`:missingComplements.map(item=>`${item.quantity} ${String(item.product?.name)}`).join(" · ")}</b></>}
          <span>Descuento total</span><b>-{money(previewDiscount)}</b>
          <strong>Total antes de facturar · tasa RD${invoiceRate.toFixed(2)}</strong>
          <strong>{money(previewTotal)} · RD${previewDop.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong>
        </div>
        {clientId&&<div className="loyalty-preview"><span>{fixedDiscountRate>0?"Descuento fijo exclusivo":automaticLoyalty?"Lealtad aplicada automáticamente":"Nivel de lealtad disponible"}</span><b>{(fixedDiscountRate>0?fixedDiscountRate:loyaltyRate).toFixed(0)}%</b>{fixedDiscountRate>0?<small>Este descuento sustituye el programa de lealtad.</small>:loyaltyRate>0&&!automaticLoyalty&&<small>El descuento manual sustituye la lealtad en esta factura.</small>}</div>}
        <label>
          Descuento manual
          <select name="manualDiscountType" value={manualDiscountType} onChange={event=>setManualDiscountType(event.target.value)}>
            <option>Porcentaje</option>
            <option>Monto</option>
          </select>
        </label>
        <label>Valor del descuento manual<input name="manualDiscountValue" type="number" min="0" step="any" value={manualDiscountValue} placeholder="0" onChange={event=>setManualDiscountValue(event.target.value)} onBlur={()=>{if(manualDiscountValue==="")setManualDiscountValue("0")}}/></label>
        <small>
          El precio mayorista se aplica automáticamente al alcanzar el mínimo
          configurado. El descuento manual sustituye la lealtad en esa factura.
        </small>
        <Field name="notes" label="Notas" value={initial?.notes} />
        <div className="invoice-form-actions">
          <button type="button" className="cancel" onClick={() => { setModal(null); setSelected(null); }}>Cancelar</button>
          <button disabled={!cart.length}>Guardar factura</button>
        </div>
        {penPromptOpen&&<div className="pen-order-prompt" role="dialog" aria-modal="true" aria-label="Agregar pluma inyectable"><div><small>COMPLEMENTO OPCIONAL</small><h3>Hay plumas disponibles</h3><p>¿Desea agregar alguna al pedido antes de guardar la factura?</p>{availablePens.map(pen=><button key={String(pen.id)} type="button" onClick={()=>{setCart([...cart,{productId:pen.id,quantity:1,unitPrice:pen.normal_price||pen.price,unitCost:pen.unit_cost||0,name:pen.name}]);setPenPromptOpen(false);setSkipPenPrompt(true)}}><span>{String(pen.name)} {String(pen.concentration||"")}</span><b>{money(pen.normal_price||pen.price)}</b></button>)}<button className="secondary" type="button" onClick={()=>{setSkipPenPrompt(true);setPenPromptOpen(false)}}>Continuar sin agregar pluma</button></div></div>}
      </form>
    );
  }
  function InvoiceDetail({ invoice }: { invoice: Row }) {
    const history = payments.filter((x) => x.invoice_id === invoice.id);
    const payCommission=async()=>{
      const due=Number(invoice.commission_due||0);if(due<=.005)return;
      if(!confirm(`¿Registrar el pago de ${money(due)} de comisión a ${String(invoice.seller_name)}?`))return;
      setError("");const response=await fetch("/api/mobile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"payInvoiceCommission",data:{invoiceId:invoice.id}})}),result=await response.json();
      if(!response.ok){setError(result.error||"No se pudo pagar la comisión");return}
      await fetch("/api/mobile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"touchRevision",data:{}})});
      const digits=String(result.sellerPhone||"").replace(/\D/g,"").replace(/^00/,""),phone=digits.length===10?`1${digits}`:digits;
      if(phone&&confirm(`Comisión registrada correctamente.\n\n¿Enviar el detalle por WhatsApp a ${String(result.sellerName)}?`))window.open(`https://wa.me/${phone}?text=${encodeURIComponent(String(result.message||""))}`,"_blank","noopener,noreferrer");
      else if(!phone)alert("La comisión fue registrada, pero el vendedor no tiene un teléfono guardado para WhatsApp.");
      setModal(null);setSelected(null);await load();
    };
    return (
      <div className="invoice-mobile-detail">
        {isInvoiceOverdue(invoice) && (
          <div className="invoice-overdue-notice" role="status">🔔 Esta factura lleva más de 15 días pendiente de pago.</div>
        )}
        <b className="invoice-total">{money(invoice.total)}</b>
        {Number(invoice.total_dop) > 0 && <div className="invoice-dop-total">RD${Number(invoice.total_dop).toLocaleString("en-US", { maximumFractionDigits: 0 })}<small>Tasa archivada: RD${Number(invoice.invoice_exchange_rate).toFixed(2)} por USD · {String(invoice.exchange_rate_date || "")}</small></div>}
        <p>
          {String(invoice.client_name)}
          <br />
          {String(invoice.seller_name)} · {String(invoice.status)}
          <br />
          Pagado {money(invoice.paid)} · Pendiente {money(invoice.balance)}
        </p>
        <div className="delivery-status-card">
          <div>
            <small>ESTADO DE ENTREGA</small>
            <b>{String(invoice.delivery_status || "Pendiente de entrega")}</b>
            {Boolean(invoice.delivered_at) && <span>Entregada el {String(invoice.delivered_at).slice(0, 10)}</span>}
            {Boolean(invoice.delivery_notes) && <span>{String(invoice.delivery_notes)}</span>}
          </div>
          {String(invoice.delivery_status) === "Entregada" ? (
            <button type="button" className="secondary" onClick={() => post("updateDeliveryStatus", { invoiceId: invoice.id, status: "Pendiente de entrega", previousStatus: invoice.delivery_status, previousDeliveredAt: invoice.delivered_at, previousNotes: invoice.delivery_notes })}>Marcar pendiente</button>
          ) : (
            <button type="button" onClick={() => post("updateDeliveryStatus", { invoiceId: invoice.id, status: "Entregada", deliveredAt: new Date().toISOString(), previousStatus: invoice.delivery_status, previousDeliveredAt: invoice.delivered_at, previousNotes: invoice.delivery_notes })}>Marcar entregada</button>
          )}
        </div>
        {Number(invoice.commission_rate||0)>0&&<div className="invoice-commission-note"><span>Comisión de esta factura</span><b>{money(Number(invoice.total||0)*Number(invoice.commission_rate||0)/100)}</b><small>{money(invoice.commission_earned)} generada · {money(invoice.commission_pending_collection)} pendiente de cobro · {money(invoice.commission_paid)} pagada</small>{isAdmin&&Number(invoice.commission_due||0)>.005&&<button type="button" onClick={payCommission}>Pagar comisión · {money(invoice.commission_due)}</button>}{isAdmin&&Number(invoice.commission_due||0)<=.005&&Number(invoice.commission_paid||0)>.005&&<em>Comisión pagada</em>}</div>}
        {history.length > 0 && (
          <div className="payment-history">
            <b>Historial de pagos</b>
            {history.map((x) => (
              <article key={String(x.id)}>
                <span>
                  {String(x.currency)} {money(x.original_amount)}
                  <small>
                    {String(x.method)} · {String(x.created_at).slice(0, 10)}
                  </small>
                </span>
                {isAdmin && (
                  <button
                    onClick={() =>
                      confirm("¿Revertir solo este pago?") &&
                      post("reversePayment", { paymentId: x.id })
                    }
                  >
                    Revertir
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
        <div className="invoice-actions">
          <button
            onClick={() =>
              window.location.assign(`/ptbr-mobile/invoices/${invoice.id}`)
            }
          >
            Imprimir / PDF
          </button>
          <button onClick={() => setModal("Editar factura")}>Editar</button>
          {Number(invoice.balance) > 0 && (
            <button onClick={() => pay(invoice)}>Aplicar pago</button>
          )}
          {isAdmin && (
            <>
              {history.length > 1 && (
                <button
                  onClick={() =>
                    confirm("¿Revertir todos los pagos?") &&
                    post("reversePayments", { invoiceId: invoice.id })
                  }
                >
                  Revertir todos
                </button>
              )}
              <button
                className="trash-button"
                title="Eliminar factura"
                aria-label="Eliminar factura"
                onClick={() =>
                  confirm("¿Eliminar esta factura y devolver el inventario?") &&
                  post("deleteInvoice", { invoiceId: invoice.id })
                }
              ><TrashIcon/></button>
            </>
          )}
        </div>
      </div>
    );
  }
  function PaymentForm({ invoice }: { invoice: Row }) {
    const invoiceRate = Number(invoice.invoice_exchange_rate || currentExchangeRate.rate || 60),
      balanceDop = Math.round(Number(invoice.balance || 0) * invoiceRate / 5) * 5,
      [currency, setCurrency] = useState("USD"),
      [amount, setAmount] = useState(Number(invoice.balance || 0).toFixed(2));
    return (
      <form
        className="mobile-form"
        onSubmit={(e) => {
          e.preventDefault();
          post("applyPayment", {
            ...val(e.currentTarget),
            invoiceId: invoice.id,
          });
        }}
      >
        <div className="form-summary">
          <span>Saldo pendiente</span>
          <b>{money(invoice.balance)}</b>
        </div>
        <label>
          Moneda
          <select
            name="currency"
            value={currency}
            onChange={(e) => {const next=e.target.value;setCurrency(next);setAmount(next === "DOP" ? balanceDop.toFixed(2) : Number(invoice.balance || 0).toFixed(2));}}
          >
            <option value="USD">USD · Dólares</option>
            <option value="DOP">DOP · Pesos dominicanos</option>
          </select>
        </label>
        <label>
          {currency === "DOP" ? "Monto recibido RD$" : "Monto recibido US$"}
          <input name="originalAmount" type="number" min="0" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label>
          Tasa archivada en la factura
          <input name="exchangeRate" type="number" readOnly value={invoiceRate.toFixed(2)} />
          <small>Esta tasa no cambia aunque el pago se realice otro día.</small>
        </label>
        <label>
          Método
          <select name="method">
            <option>Efectivo</option>
            <option>Transferencia</option>
            <option>Tarjeta</option>
            <option>Depósito</option>
            <option>Otro</option>
          </select>
        </label>
        <label>
          Si existe excedente
          <select name="excessAction">
            <option value="Devolución">Hacer devolución</option>
            <option value="Caja">Dejar en caja</option>
          </select>
        </label>
        <button>Aplicar pago</button>
      </form>
    );
  }
  function WithdrawalForm() {
    return (
      <form className="mobile-form" onSubmit={submit("saveWithdrawal")}>
        <Select
          name="teamMemberId"
          label="Socio / integrante"
          items={team}
          render={(x) => `${x.name} · ${x.role}`}
        />
        <Select
          name="productId"
          label="Producto"
          items={alphabeticalProducts}
          render={(x) => `${x.name} ${x.concentration}`}
        />
        <label>
          Motivo
          <select name="type">
            <option>Retiro de socio al costo</option>
            <option>Gasto de representación</option>
            <option>Promoción / muestra</option>
          </select>
        </label>
        <Field
          name="quantity"
          label="Cantidad"
          type="number"
          required
          value="1"
        />
        <Field name="notes" label="Notas" />
        <small>
          El valor se calcula automáticamente usando el costo unitario del
          producto y se descuenta del inventario del socio.
        </small>
        <button>Registrar retiro</button>
      </form>
    );
  }
  function WithdrawalPayment({ initial }: { initial: Row }) {
    const history = withdrawalPayments.filter(
      (x) => x.withdrawal_id === initial.id,
    );
    return (
      <div className="withdrawal-detail">
        <div className="form-summary">
          <span>Saldo del retiro</span>
          <b>{money(initial.balance)}</b>
        </div>
        {history.map((x) => (
          <p key={String(x.id)}>
            <b>{money(x.amount)}</b> · {String(x.source)}
            <small>{String(x.created_at).slice(0, 10)}</small>
          </p>
        ))}
        {Number(initial.balance) > 0 && (
          <form
            className="mobile-form"
            onSubmit={(e) => {
              e.preventDefault();
              post("payWithdrawal", {
                ...val(e.currentTarget),
                withdrawalId: initial.id,
              });
            }}
          >
            <Field
              name="amount"
              label="Monto"
              type="number"
              required
              value={initial.balance}
            />
            <label>
              Cómo se salda
              <select name="source">
                <option>Descontar de aporte</option>
                <option>Pago recibido</option>
              </select>
            </label>
            <label>
              Método
              <select name="method">
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Otro</option>
              </select>
            </label>
            <Field name="notes" label="Notas" />
            <button>Aplicar pago</button>
          </form>
        )}
        {Number(initial.paid || 0) === 0 && (
          <button
            className="trash-button standalone-trash"
            title="Eliminar retiro"
            aria-label="Eliminar retiro"
            onClick={() =>
              confirm("¿Eliminar este retiro y devolver el inventario?") &&
              post("deleteWithdrawal", { id: initial.id })
            }
          ><TrashIcon/></button>
        )}
      </div>
    );
  }
  function PeptibraPaymentForm() {
    const due = Number(access.remittanceDue || 0);
    return (
      <form onSubmit={submit("notifyPeptibraPayment")} className="mobile-form">
        <div className="form-summary">
          <span>Pendiente después de tu comisión</span>
          <b>{money(due)}</b>
        </div>
        <Field name="amount" label="Monto que pagarás (USD)" type="number" required value={due.toFixed(2)} />
        <label>
          Método
          <select name="method">
            <option>Transferencia</option>
            <option>Efectivo</option>
            <option>Depósito</option>
            <option>Otro</option>
          </select>
        </label>
        <Field name="reference" label="Referencia o comprobante" />
        <Field name="notes" label="Notas" />
        <small>Esto notificará al administrador. El dinero entrará a Caja Peptibra solamente cuando administración confirme que lo recibió.</small>
        <button disabled={due <= 0}>Notificar pago a Peptibra</button>
      </form>
    );
  }
  function CashForm() {
    const [movement, setMovement] = useState("Gasto del negocio"),
      needsTeam = movement === "Pagar comisión",
      needsPartner = [
        "Dinero puesto por socio",
        "Compra pagada por socio",
        "Devolver dinero a socio",
        "Repartir ganancias",
      ].includes(movement),
      members = needsTeam ? team : team.filter((t) => t.role === "Socio");
    return (
      <form onSubmit={submit("cashMovement")} className="mobile-form">
        <label>
          Movimiento
          <select
            name="movement"
            value={movement}
            onChange={(e) => setMovement(e.target.value)}
          >
            <option>Dinero puesto por socio</option>
            <option>Compra pagada por socio</option>
            <option>Gasto del negocio</option>
            <option>Compra pagada por la caja</option>
            <option>Pagar comisión</option>
            <option>Devolver dinero a socio</option>
            <option>Repartir ganancias</option>
          </select>
        </label>
        <Field name="amount" label="Monto USD" type="number" required />
        {(needsTeam || needsPartner) && (
          <Select
            name="partnerId"
            label={needsTeam ? "Integrante" : "Socio"}
            items={members}
            render={(x) => String(x.name)}
          />
        )}
        <Field name="notes" label="Notas" />
        <small>
          El movimiento y su efecto en Caja se registrarán con las mismas reglas
          utilizadas por Windows.
        </small>
        <button>Registrar movimiento</button>
      </form>
    );
  }
  function TeamForm({ initial }: { initial: Row | null }) {
    const [savingMember, setSavingMember] = useState(false);
    const [memberError, setMemberError] = useState("");
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (savingMember) return;
          setSavingMember(true);
          setMemberError("");
          const values = val(e.currentTarget), accessEmail = String(values.accessEmail || "").trim();
          delete values.accessEmail;
          try {
            const memberResponse = await fetch("/api/mobile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "saveTeam", data: { ...values, id: initial?.id } }) });
            const memberResult = await memberResponse.json();
            if (!memberResponse.ok) { setMemberError(memberResult.error || "No se pudo guardar el integrante"); return; }
            if (accessEmail) {
              const accessResponse = await fetch("/api/desktop-users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "upsert", email: accessEmail, teamId: memberResult.id }) });
              const accessResult = await accessResponse.json();
              if (!accessResponse.ok) { setMemberError(`El integrante se guardó, pero no se pudo crear su acceso: ${accessResult.error || "error desconocido"}`); await load(); return; }
              alert(accessResult.emailSent ? accessResult.message : `${accessResult.message}\n\nContraseña temporal: ${accessResult.temporaryPassword}`);
            }
            await fetch("/api/mobile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "touchRevision", data: {} }) });
            setModal(null);
            setSelected(null);
            await load();
          } catch {
            setMemberError("No se pudo conectar para guardar el integrante.");
          } finally {
            setSavingMember(false);
          }
        }}
        className="mobile-form"
      >
        <Field name="name" label="Nombre" required value={initial?.name} />
        <Field name="phone" label="Teléfono" value={initial?.phone} />
        <label>
          Categoría
          <select
            name="role"
            defaultValue={String(initial?.role || "Vendedor")}
          >
            <option>Vendedor</option>
            <option>Socio</option>
          </select>
        </label>
        <small><b>Vendedor:</b> maneja sus ventas, inventario y comisión personal. <b>Socio:</b> maneja su operación e inventario privado. La administración conserva la vista global y es la única que crea accesos.</small>
        <Select
          name="partnerId"
          label="Socio responsable"
          items={team.filter((t) => t.role === "Socio")}
          render={(x) => String(x.name)}
          optional
          value={initial?.partner_id}
        />
        <div className="form-pair">
          <Field
            name="commission"
            label="Comisión %"
            type="number"
            value={initial?.commission}
          />
          <Field
            name="maxDiscount"
            label="Descuento máximo %"
            type="number"
            value={initial?.max_discount}
          />
        </div>
        <Field name="notes" label="Notas" value={initial?.notes} />
        <Field name="accessEmail" label="Correo para acceso (opcional)" type="email" />
        <small>Si indicas un correo, se crearán las credenciales y se enviará una contraseña temporal. El usuario verá el mismo catálogo con su inventario personal comenzando en cero.</small>
        {memberError && <div className="product-form-error">{memberError}</div>}
        <button disabled={savingMember}>{savingMember ? "Guardando…" : "Guardar integrante"}</button>
        {initial && Boolean(initial.can_edit) && (
          <button
            type="button"
            className="danger"
            onClick={() =>
              confirm("¿Archivar integrante?") &&
              post("archive", { entity: "team", id: initial.id })
            }
          >
            Archivar
          </button>
        )}
      </form>
    );
  }
  function SupplierForm({ initial }: { initial: Row | null }) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          post("saveSupplier", { ...val(e.currentTarget), id: initial?.id });
        }}
        className="mobile-form"
      >
        <Field name="name" label="Proveedor" required value={initial?.name} />
        <Field name="phone" label="Teléfono" value={initial?.phone} />
        <Field name="notes" label="Notas" value={initial?.notes} />
        <button>Guardar proveedor</button>
        {initial && (
          <button
            type="button"
            className="danger"
            onClick={() =>
              confirm("¿Archivar proveedor?") &&
              post("archive", { entity: "supplier", id: initial.id })
            }
          >
            Archivar
          </button>
        )}
      </form>
    );
  }
  function PurchaseForm({ initial }: { initial: Row | null }) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          post("savePurchase", { ...val(e.currentTarget), id: initial?.id });
        }}
        className="mobile-form"
      >
        <Select
          name="supplierId"
          label="Proveedor"
          items={suppliers}
          render={(x) => String(x.name)}
          value={initial?.supplier_id}
        />
        <Field name="number" label="Número" value={initial?.number} />
        <Field
          name="concept"
          label="Concepto"
          required
          value={initial?.concept}
        />
        <label>
          Tipo
          <select
            name="type"
            defaultValue={String(initial?.type || "Inventario / insumos")}
          >
            <option>Inventario / insumos</option>
            <option>Gasto operativo</option>
          </select>
        </label>
        <div className="form-pair">
          <Field
            name="total"
            label="Total"
            type="number"
            value={initial?.total}
          />
          <Field
            name="paid"
            label="Pagado"
            type="number"
            value={initial?.paid}
          />
        </div>
        <button>Guardar compra</button>
        {initial && (
          <button
            type="button"
            className="trash-button"
            title="Eliminar compra"
            aria-label="Eliminar compra"
            onClick={() =>
              confirm("¿Eliminar compra?") &&
              post("deletePurchase", { id: initial.id })
            }
          ><TrashIcon/></button>
        )}
      </form>
    );
  }
  function CalculationForm({ initial }: { initial: Row | null }) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          post("saveCalculation", { ...val(e.currentTarget), id: initial?.id });
        }}
        className="mobile-form"
      >
        <Field name="name" label="Nombre" required value={initial?.name} />
        <div className="form-pair">
          <Field
            name="productCost"
            label="Producto"
            type="number"
            value={initial?.product_cost}
          />
          <Field
            name="shipping"
            label="Envío"
            type="number"
            value={initial?.shipping}
          />
        </div>
        <div className="form-pair">
          <Field
            name="labelCost"
            label="Etiqueta"
            type="number"
            value={initial?.label_cost}
          />
          <Field
            name="packaging"
            label="Empaque"
            type="number"
            value={initial?.packaging}
          />
        </div>
        <div className="form-pair">
          <Field
            name="bacCost"
            label="Agua BAC"
            type="number"
            value={initial?.bac_cost}
          />
          <Field
            name="otherCost"
            label="Otros"
            type="number"
            value={initial?.other_cost}
          />
        </div>
        <div className="form-pair">
          <Field
            name="units"
            label="Unidades"
            type="number"
            value={initial?.units}
          />
          <Field
            name="salePrice"
            label="Precio venta"
            type="number"
            value={initial?.sale_price}
          />
        </div>
        <button>Guardar cálculo</button>
      </form>
    );
  }
  function ProtocolForm({ initial }: { initial: Row | null }) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          post("saveProtocol", {
            ...val(e.currentTarget),
            id: initial?.id,
            includeInstructions:
              new FormData(e.currentTarget).get("includeInstructions") === "on",
          });
        }}
        className="mobile-form"
      >
        <Select
          name="productId"
          label="Producto"
          items={alphabeticalProducts}
          render={(x) => `${x.name} ${x.concentration}`}
          value={initial?.product_id}
        />
        <Field
          name="name"
          label="Nombre del protocolo"
          required
          value={initial?.name}
        />
        <div className="form-pair">
          <Field
            name="vialMg"
            label="Vial mg"
            type="number"
            value={initial?.vial_mg}
          />
          <Field
            name="diluentMl"
            label="Agua mL"
            type="number"
            value={initial?.diluent_ml}
          />
        </div>
        <div className="form-pair">
          <Field
            name="dose"
            label="Dosis"
            type="number"
            value={initial?.dose}
          />
          <Field
            name="everyDays"
            label="Cada días"
            type="number"
            value={initial?.every_days}
          />
        </div>
        <Field
          name="weeks"
          label="Semanas"
          type="number"
          value={initial?.weeks}
        />
        <label className="check-row">
          <input
            name="includeInstructions"
            type="checkbox"
            defaultChecked={Boolean(initial?.include_instructions)}
          />{" "}
          Incluir instrucciones de reconstitución
        </label>
        <button>Guardar protocolo</button>
        {initial && (
          <>
            <button
              type="button"
              onClick={() =>
                window.location.assign(`/ptbr-mobile/protocols/${initial.id}`)
              }
            >
              Imprimir / Guardar PDF
            </button>
            <button
              type="button"
              className="trash-button"
              title="Eliminar protocolo"
              aria-label="Eliminar protocolo"
              onClick={() =>
                confirm("¿Eliminar protocolo?") &&
                post("deleteProtocol", { id: initial.id })
              }
            ><TrashIcon/></button>
          </>
        )}
      </form>
    );
  }
}

function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mobile-modal-bg" onMouseDown={close}>
      <section
        className="mobile-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <span>{title === "BAC Lab" ? "HERRAMIENTA INTERNA" : "NUEVO REGISTRO"}</span>
            <h2>{title}</h2>
          </div>
          <button onClick={close}>×</button>
        </header>
        {children}
      </section>
    </div>
  );
}
function BacLab() {
  const [mode, setMode] = useState<"final" | "water">("final");
  const [amount, setAmount] = useState("10");
  const parsed = Number(amount.replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed > 0;
  const finalTotal = valid
    ? mode === "water"
      ? parsed / 0.9909
      : parsed
    : 0;
  const water = valid
    ? mode === "water"
      ? parsed
      : finalTotal * 0.9909
    : 0;
  const alcohol = valid ? finalTotal - water : 0;
  const volume = (value: number) =>
    valid
      ? `${value.toLocaleString("en-US", {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        })} mL`
      : "—";

  return (
    <div className="bac-lab">
      <p>
        Calcula las proporciones para preparar agua bacteriostática con una
        concentración final de alcohol bencílico de <b>0.91%</b>.
      </p>
      <div className="bac-lab-controls">
        <label>
          Calcular a partir de
          <select value={mode} onChange={(event) => setMode(event.target.value as "final" | "water")}>
            <option value="final">Volumen final deseado</option>
            <option value="water">Agua estéril disponible</option>
          </select>
        </label>
        <label>
          Cantidad (mL)
          <input
            type="number"
            inputMode="decimal"
            min="0.001"
            step="0.001"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
      </div>
      <div className="bac-lab-results">
        <article><span>Agua estéril</span><b>{volume(water)}</b></article>
        <article>
          <span>Alcohol bencílico</span><b>{volume(alcohol)}</b>
          <small>0.91% del volumen final</small>
        </article>
        <article><span>Volumen final</span><b>{volume(finalTotal)}</b></article>
      </div>
      <div className={`bac-lab-formula ${valid ? "" : "invalid"}`}>
        {valid
          ? `${volume(water)} de agua + ${volume(alcohol)} de alcohol bencílico = ${volume(finalTotal)}`
          : "Escribe una cantidad mayor que cero."}
      </div>
      <p className="bac-lab-note">
        Cálculo volumétrico únicamente. Utiliza técnica aséptica, insumos aptos
        y los procedimientos autorizados para tu operación.
      </p>
    </div>
  );
}
function Card({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
    </article>
  );
}
function FlowAction({
  icon,
  title,
  hint,
  tone,
  action,
}: {
  icon: string;
  title: string;
  hint: string;
  tone: string;
  action: () => void;
}) {
  return (
    <button className={tone} onClick={action}>
      <i>{icon}</i>
      <b>{title}</b>
      <span>{hint}</span>
      <em>›</em>
    </button>
  );
}
function PageHead({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mobile-page-head">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  );
}
function ListTitle({ title, action }: { title: string; action?: () => void }) {
  return (
    <div className="list-title">
      <h2>{title}</h2>
      {action && <button onClick={action}>Ver todo</button>}
    </div>
  );
}
function Module({
  title,
  count,
  action,
}: {
  title: string;
  count: number;
  action: () => void;
}) {
  return (
    <button onClick={action}>
      <i>{title.slice(0, 1)}</i>
      <b>{title}</b>
      <span>{count ? `${count} registros` : "Abrir"}</span>
    </button>
  );
}
function Field({
  name,
  label,
  type = "text",
  required = false,
  value,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  value?: unknown;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        step={type === "number" ? "any" : undefined}
        required={required}
        defaultValue={value == null ? "" : String(value)}
      />
    </label>
  );
}
function Select({
  name,
  label,
  items,
  render,
  optional = false,
  value,
}: {
  name: string;
  label: string;
  items: Row[];
  render: (x: Row) => string;
  optional?: boolean;
  value?: unknown;
}) {
  return (
    <label>
      {label}
      <select
        name={name}
        required={!optional}
        defaultValue={value == null ? "" : String(value)}
      >
        <option value="">{optional ? "Ninguno" : "Seleccionar"}</option>
        {items.map((x) => (
          <option key={String(x.id)} value={String(x.id)}>
            {render(x)}
          </option>
        ))}
      </select>
    </label>
  );
}

