"use client";
import Image from "next/image";
import "./mobile-enhancements.css";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;
type View = "home" | "sales" | "inventory" | "clients" | "cash" | "protocols" | "more";
const money = (v: unknown) =>
  `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const val = (form: HTMLFormElement) => Object.fromEntries(new FormData(form));

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
    [search, setSearch] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
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
      window.location.href = "/ptbr-mobile/settings";
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
    if (action !== "touchRevision")
      await fetch("/api/mobile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "touchRevision", data: {} }),
      });
    setModal(null);
    await load();
    return j;
  };
  const products = data.products || [],
    balances = data.balances || [],
    inventoryMovements = data.inventoryMovements || [],
    team = data.team || [],
    clients = data.clients || [],
    invoices = data.invoices || [],
    invoiceItems = data.invoiceItems || [],
    payments = data.payments || [],
    cash = data.cash || [],
    suppliers = data.suppliers || [],
    purchases = data.purchases || [],
    calculations = data.calculations || [],
    protocols = data.protocols || [],
    internalWithdrawals = data.internalWithdrawals || [],
    withdrawalPayments = data.withdrawalPayments || [],
    settings = data.settings || [],
    access = (data as unknown as { user?: Row }).user || {},
    snapshot =
      (data as unknown as { financialSnapshot?: Row }).financialSnapshot || {},
    role = String(access.role || "vendedor"),
    isAdmin = role === "admin",
    isPartner = role === "socio",
    isSeller = role === "vendedor";
  const stock = (id: unknown) =>
      balances
        .filter((x) => x.product_id === id)
        .reduce((s, x) => s + Number(x.quantity || 0), 0),
    cashTotal = Number(snapshot.cash || 0),
    pending = invoices.reduce((s, x) => s + Number(x.balance || 0), 0),
    retention = Number(snapshot.retention || 0),
    reserve = Number(snapshot.reserve || 0),
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
  const filtered = products.filter((p) =>
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
            src="/peptibra-logo-original.png"
            width={1774}
            height={887}
            alt="Peptibra Peptide Depot"
            priority
          />
        </div>
        <label className="flow-search">
          <span>⌕</span>
          <input placeholder="Buscar clientes, productos, facturas…" />
        </label>
        <div className="mobile-account">
          <span className="sync-pill">✓ Sincronizado</span>
          <b>{userName.split(" ")[0]}</b>
          <a href="/ptbr-mobile/settings">Cambiar contraseña</a>
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
          <Inventory />
        ) : safeView === "clients" ? (
          <Clients />
        ) : safeView === "cash" ? (
          <Cash />
        ) : safeView === "protocols" ? (
          <Protocols />
        ) : (
          <More />
        )}
      </section>
      <nav className={`mobile-nav role-${role}`}>
        {(
          [
            ["home", "⌂", "Inicio"],
            ["sales", "▱", "Vender"],
            ["inventory", "□", "Productos"],
            ["protocols", "⌁", "Protocolos"],
            ["cash", "▣", "Caja"],
            ["more", "•••", "Más"],
            ["clients", "○", "Clientes"],
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
              onClick={() => setView(id)}
            >
              <i>{icon}</i>
              <span>{label}</span>
            </button>
          ))}
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
          ) : modal === "Aplicar pago" ? (
            <PaymentForm invoice={selected!} />
          ) : modal === "Pagar a Peptibra" ? (
            <PeptibraPaymentForm />
          ) : modal === "Pagar retiro" ? (
            <WithdrawalPayment initial={selected!} />
          ) : modal.toLowerCase().includes("retiro") ? (
            <WithdrawalForm />
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
    const lowStock = products.filter((p) => stock(p.id) <= 0).length,
      pendingInvoices = invoices.filter((i) => Number(i.balance || 0) > 0),
      pendingRemittances = cash.filter((m) => String(m.category) === "Pago a Peptibra pendiente");
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
            action={() => setModal("Nueva factura")}
          />
          {isAdmin ? (
            <>
              <FlowAction
                icon="▣"
                title="Cobrar"
                hint="Registrar un pago"
                tone="sage"
                action={() => setView("sales")}
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
              <FlowAction icon="▣" title="Cobrar" hint="Registrar un pago" tone="sage" action={() => setView("sales")} />
              {isSeller && <FlowAction icon="↑" title="Pagar" hint="Pagar a Peptibra" tone="blue" action={() => setModal("Pagar a Peptibra")} />}
            </>
          )}
        </div>
        <div className={`flow-strip ${!isAdmin ? "team" : ""}`}>
          {isAdmin && (
            <Card label="Hoy en caja" value={money(cashTotal)} tone="green" />
          )}
          <Card label="Por cobrar" value={money(pending)} tone="amber" />
          <Card
            label="En stock"
            value={String(products.reduce((s, p) => s + stock(p.id), 0))}
            tone="blue"
          />
          {!isAdmin && <>
            <Card label="Mis ventas" value={money(invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0))} tone="green" />
            <Card label="Mis comisiones" value={money(access.commissionTotal)} tone="green" />
          </>}
        </div>
        <ListTitle title="Para resolver" action={() => setView("sales")} />
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
            <button onClick={() => setView("sales")}>
              <i>▤</i>
              <span>
                <b>{pendingInvoices.length} factura(s) por cobrar</b>
                <small>{money(pending)} pendiente</small>
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
        <ListTitle title="Lo más reciente" action={() => setView("sales")} />
        <div className="mobile-list recent-flow">
          {invoices.slice(0, 4).map((i) => (
            <article
              key={String(i.id)}
              onClick={() => {
                setSelected(i);
                setModal("Detalle de factura");
              }}
            >
              <div>
                <b>{String(i.client_name)}</b>
                <span>{String(i.number)}</span>
              </div>
              <div className="right">
                <b>{money(i.total)}</b>
                <em className={String(i.status).toLowerCase()}>
                  {String(i.status)}
                </em>
              </div>
            </article>
          ))}
        </div>
      </>
    );
  }
  function Sales() {
    return (
      <>
        <PageHead
          eyebrow={isSeller ? "MIS RESULTADOS" : "OPERACIONES"}
          title={isSeller ? "Mis ventas y comisiones" : "Ventas y facturas"}
          action="+ Factura"
          onAction={() => setModal("Nueva factura")}
        />
        {isSeller && (
          <div className="cash-hero">
            <span>Comisiones acumuladas</span>
            <b>{money(access.commissionTotal)}</b>
            <small>
              Calculadas al {Number(access.commissionRate || 0).toFixed(2)}%
              sobre tus ventas registradas
            </small>
          </div>
        )}
        <div className="mobile-list roomy">
          {invoices.map((i) => (
            <article
              key={String(i.id)}
              onClick={() => {
                setSelected(i);
                setModal("Detalle de factura");
              }}
            >
              <div>
                <b>{String(i.number)}</b>
                <span>
                  {String(i.client_name)} · {String(i.seller_name)}
                </span>
                <small>{String(i.created_at).slice(0, 10)}</small>
              </div>
              <div className="right">
                <b>{money(i.total)}</b>
                <em className={String(i.status).toLowerCase()}>
                  {String(i.status)}
                </em>
              </div>
            </article>
          ))}
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
        {isAdmin && (
          <button
            className="print-module"
            onClick={() => window.open("/ptbr-mobile/price-list", "_blank")}
          >
            Lista de precios · Imprimir / PDF
          </button>
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
                  <b
                    className={
                      qty < 0
                        ? "negative"
                        : qty <= Number(p.reorder_point)
                          ? "low"
                          : ""
                    }
                  >
                    {qty}
                  </b>
                  <span>unidades</span>
                  {isAdmin && (
                    <>
                      <div>
                        <button onClick={() => adjust(p, -1)}>−</button>
                        <button onClick={() => adjust(p, 1)}>+</button>
                      </div>
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
  function Clients() {
    return (
      <>
        <PageHead
          eyebrow="RELACIONES"
          title="Clientes"
          action="+ Cliente"
          onAction={() => setModal("Nuevo cliente")}
        />
        <div className="mobile-list roomy">
          {clients.map((c) => (
            <article
              key={String(c.id)}
              onClick={() => {
                setSelected(c);
                setModal("Editar cliente");
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
              </div>
              <button className="mini">Editar</button>
            </article>
          ))}
        </div>
      </>
    );
  }
  function Cash() {
    return (
      <>
        <PageHead
          eyebrow="FINANZAS"
          title="Caja e insights"
          action="+ Movimiento"
          onAction={() => setModal("Movimiento de caja")}
        />
        <div className="cash-hero">
          <span>Disponible en caja</span>
          <b>{money(cashTotal)}</b>
          <small>Todos los movimientos están expresados en USD</small>
          <button onClick={() => window.open("/ptbr-mobile/cash", "_blank")}>
            Imprimir / Guardar PDF
          </button>
        </div>
        <div className="mobile-metrics cash-metrics">
          <Card
            label="Para reponer inventario"
            value={money(reserve)}
            tone="amber"
          />
          <Card
            label="Dinero puesto por socios"
            value={money(
              partnerBalances.reduce((s, x) => s + Math.max(0, x.amount), 0),
            )}
          />
          <Card
            label="Guardado para el negocio"
            value={money(retained)}
            tone="blue"
          />
          <Card
            label="Ganancias disponibles"
            value={money(distributable)}
            tone="green"
          />
        </div>
        <div className="cash-explanation">
          Ganancia cobrada {money(netProfit)} · Proveedores pendientes{" "}
          {money(supplierDue)} · Se guarda {retention.toFixed(1)}% para el
          negocio.
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
        <ListTitle title="Movimientos" />
        <div className="mobile-list roomy">
          {cash.map((m) => (
            <article key={String(m.id)}>
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
                {!m.invoice_id && !m.withdrawal_id && !m.purchase_id && !["Pago a Peptibra pendiente","Pago de vendedor a Peptibra"].includes(String(m.category)) && (
                  <button
                    className="edit-link"
                    onClick={() =>
                      confirm("¿Eliminar este movimiento manual?") &&
                      post("deleteCashMovement", { id: m.id })
                    }
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </>
    );
  }
  function Protocols() {
    return (
      <>
        <PageHead eyebrow="DOCUMENTOS" title="Protocolos" />
        <p className="page-intro">Abre un protocolo para imprimirlo, guardarlo como PDF o compartirlo con tu cliente.</p>
        <div className="mobile-list roomy">
          {protocols.map((p) => (
            <article
              key={String(p.id)}
              onClick={() => window.open(`/ptbr-mobile/protocols/${p.id}`, "_blank")}
            >
              <div>
                <b>{String(p.name)}</b>
                <span>{String(products.find((x) => x.id === p.product_id)?.name || "")}</span>
              </div>
              <div className="right">
                <b>Abrir</b>
                <small>Imprimir / PDF</small>
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
            title="Calculadora"
            count={calculations.length}
            action={() => setModal("Nuevo cálculo")}
          />
          <Module
            title="Protocolos"
            count={protocols.length}
            action={() => setModal("Nuevo protocolo")}
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
              </div>
              <div className="right">
                <b>{Number(t.commission).toFixed(1)}%</b>
                <small>comisión</small>
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
        <ListTitle title="Protocolos" />
        <div className="mobile-list">
          {protocols.map((p) => (
            <article
              key={String(p.id)}
              onClick={() => {
                setSelected(p);
                setModal("Editar protocolo");
              }}
            >
              <div>
                <b>{String(p.name)}</b>
                <span>
                  {String(
                    products.find((x) => x.id === p.product_id)?.name || "",
                  )}
                </span>
              </div>
            </article>
          ))}
        </div>
      </>
    );
  }
  async function adjust(p: Row, change: number) {
    await post("adjustStock", {
      productId: p.id,
      location: "GENERAL",
      change,
      reason: "Ajuste desde móvil",
    });
  }
  async function uploadPhoto(productId: unknown, file: File) {
    const form = new FormData();
    form.set("productId", String(productId));
    form.set("file", file);
    setError("");
    const r = await fetch("/api/mobile/upload", { method: "POST", body: form }),
      j = await r.json();
    if (!r.ok) {
      setError(j.error || "No se pudo subir la fotografía");
      return;
    }
    await load();
  }
  async function transfer(p: Row) {
    const locations = [
        "GENERAL",
        ...team.map((x) =>
          x.role === "Socio" ? `SOCIO:${x.id}` : `VENDEDOR:${x.id}`,
        ),
      ],
      from = prompt(`Desde:\n${locations.join("\n")}`, "GENERAL"),
      to = prompt(`Hacia:\n${locations.join("\n")}`, locations[1] || "GENERAL"),
      quantity = Number(prompt("Cantidad a transferir:", "1"));
    if (from && to && quantity > 0)
      await post("transferInventory", { productId: p.id, from, to, quantity });
  }
  async function locationAdjust(p: Row, location: string) {
    const change = Number(
      prompt(`Ajuste para ${location}. Usa negativo para restar:`, "0"),
    );
    if (change)
      await post("adjustStock", {
        productId: p.id,
        location,
        change,
        reason: "Ajuste manual desde móvil",
      });
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
    const variantByMg = new Map(family.map((x) => [mgOf(x.concentration), x]));
    const otherVariant =
      initial && !mgOf(initial.concentration) ? initial : null;
    const locations = initial
      ? balances.filter((x) => x.product_id === initial.id)
      : [];
    const moves = initial
      ? inventoryMovements
          .filter((x) => x.product_id === initial.id)
          .slice(-8)
          .reverse()
      : [];
    return (
      <>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            post("saveProductFamily", {
              ...val(e.currentTarget),
              id: initial?.id,
              oldName: initial?.name,
            });
          }}
          className="mobile-form"
        >
          <Field name="name" label="Nombre" required value={initial?.name} />
          <Field
            name="sku"
            label="Código base / SKU"
            required
            value={initial?.sku}
          />
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
          {initial && (
            <label>
              Fotografía
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) =>
                  e.target.files?.[0] &&
                  uploadPhoto(initial.id, e.target.files[0])
                }
              />
            </label>
          )}
          <button>Guardar producto y presentaciones</button>
          {initial && (
            <>
              <button type="button" onClick={() => transfer(initial)}>
                Transferir inventario de {String(initial.concentration)}
              </button>
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
        {initial && isAdmin && (
          <div className="inventory-locations">
            <h3>Existencias de {String(initial.concentration)}</h3>
            {locations.map((x) => (
              <button
                key={String(x.id)}
                onClick={() => locationAdjust(initial, String(x.location))}
              >
                <span>{String(x.location)}</span>
                <b className={Number(x.quantity) < 0 ? "negative" : ""}>
                  {String(x.quantity)}
                </b>
              </button>
            ))}
            <h3>Movimientos recientes</h3>
            {moves.map((x) => (
              <p key={String(x.id)}>
                <b>
                  {Number(x.change) > 0 ? "+" : ""}
                  {String(x.change)}
                </b>{" "}
                {String(x.reason)}
                <small>{String(x.created_at).slice(0, 10)}</small>
              </p>
            ))}
          </div>
        )}
      </>
    );
  }
  function ClientForm({ initial }: { initial: Row | null }) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          post("saveClient", { ...val(e.currentTarget), id: initial?.id });
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
      [quantity, setQuantity] = useState(1),
      [clientId, setClientId] = useState(String(initial?.client_id || "")),
      [quickOpen, setQuickOpen] = useState(false),
      [quickFirst, setQuickFirst] = useState(""),
      [quickLast, setQuickLast] = useState(""),
      [quickPhone, setQuickPhone] = useState(""),
      [quickClient, setQuickClient] = useState<Row | null>(null),
      [savingClient, setSavingClient] = useState(false);
    const chosen = products.find((p) => String(p.id) === product),
      seller = team.find((x) => String(x.id) === sellerId),
      available = balances
        .filter(
          (x) =>
            String(x.product_id) === product &&
            String(x.location) === `VENDEDOR:${sellerId}`,
        )
        .reduce((s, x) => s + Number(x.quantity || 0), 0),
      gross = cart.reduce(
        (s, x) => s + Number(x.quantity) * Number(x.unitPrice),
        0,
      );
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
      setQuickOpen(false);
    };
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = val(e.currentTarget);
          post(initial ? "updateInvoice" : "createInvoice", {
            ...f,
            progressiveEnabled:
              new FormData(e.currentTarget).get("progressiveEnabled") === "on",
            id: initial?.id,
            number: initial?.number,
            items: cart,
          });
        }}
        className="mobile-form"
      >
        <div className="invoice-client-picker">
          <label>
            Cliente
            <select
              name="clientId"
              required
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            >
              <option value="">Seleccionar</option>
              {clients.map((client) => (
                <option key={String(client.id)} value={String(client.id)}>
                  {String(client.code)} · {String(client.first_name)} {String(client.last_name)}
                </option>
              ))}
              {quickClient && (
                <option value={String(quickClient.id)}>
                  {String(quickClient.code)} · {String(quickClient.first_name)} {String(quickClient.last_name)}
                </option>
              )}
            </select>
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
            {products.map((p) => (
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
              onChange={(e) =>
                setQuantity(Math.max(1, Number(e.target.value) || 1))
              }
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
                  quantity,
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
              value={Number(x.quantity)}
              onChange={(e) =>
                setCart(
                  cart.map((y, k) =>
                    k === n ? { ...y, quantity: Number(e.target.value) } : y,
                  ),
                )
              }
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
          <span>Subtotal estimado</span>
          <b>{money(gross)}</b>
        </div>
        <label className="check-row">
          <input name="progressiveEnabled" type="checkbox" /> Aplicar descuento
          progresivo
        </label>
        <div className="form-pair">
          <Field name="minQty" label="Desde unidades" type="number" value="2" />
          <Field
            name="minPct"
            label="Descuento mínimo %"
            type="number"
            value="5"
          />
        </div>
        <div className="form-pair">
          <Field
            name="maxQty"
            label="Máximo en unidades"
            type="number"
            value="10"
          />
          <Field
            name="maxPct"
            label="Descuento máximo %"
            type="number"
            value="15"
          />
        </div>
        <label>
          Descuento manual
          <select name="manualDiscountType">
            <option>Porcentaje</option>
            <option>Monto</option>
          </select>
        </label>
        <Field
          name="manualDiscountValue"
          label="Valor del descuento manual"
          type="number"
          value="0"
        />
        <small>
          El precio mayorista se aplica automáticamente al alcanzar el mínimo
          configurado y sustituye el descuento progresivo de esa línea.
        </small>
        <Field name="notes" label="Notas" value={initial?.notes} />
        <button disabled={!cart.length}>Guardar factura</button>
      </form>
    );
  }
  function InvoiceDetail({ invoice }: { invoice: Row }) {
    const history = payments.filter((x) => x.invoice_id === invoice.id);
    return (
      <div className="invoice-mobile-detail">
        <b className="invoice-total">{money(invoice.total)}</b>
        <p>
          {String(invoice.client_name)}
          <br />
          {String(invoice.seller_name)} · {String(invoice.status)}
          <br />
          Pagado {money(invoice.paid)} · Pendiente {money(invoice.balance)}
        </p>
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
              window.open(`/ptbr-mobile/invoices/${invoice.id}`, "_blank")
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
                className="danger"
                onClick={() =>
                  confirm("¿Eliminar esta factura y devolver el inventario?") &&
                  post("deleteInvoice", { invoiceId: invoice.id })
                }
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>
    );
  }
  function PaymentForm({ invoice }: { invoice: Row }) {
    const [currency, setCurrency] = useState("USD");
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
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="USD">USD · Dólares</option>
            <option value="DOP">DOP · Pesos dominicanos</option>
          </select>
        </label>
        <Field
          name="originalAmount"
          label={
            currency === "DOP" ? "Monto recibido RD$" : "Monto recibido US$"
          }
          type="number"
          required
        />
        <Field
          name="exchangeRate"
          label="Tasa DOP por USD"
          type="number"
          required
          value={currency === "DOP" ? "60" : "1"}
        />
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
          items={products}
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
            className="standalone-danger"
            onClick={() =>
              confirm("¿Eliminar este retiro y devolver el inventario?") &&
              post("deleteWithdrawal", { id: initial.id })
            }
          >
            Eliminar retiro
          </button>
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
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          post("saveTeam", { ...val(e.currentTarget), id: initial?.id });
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
        <button>Guardar integrante</button>
        {initial && (
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
            className="danger"
            onClick={() =>
              confirm("¿Eliminar compra?") &&
              post("deletePurchase", { id: initial.id })
            }
          >
            Eliminar
          </button>
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
          items={products}
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
                window.open(`/ptbr-mobile/protocols/${initial.id}`, "_blank")
              }
            >
              Imprimir / Guardar PDF
            </button>
            <button
              type="button"
              className="danger"
              onClick={() =>
                confirm("¿Eliminar protocolo?") &&
                post("deleteProtocol", { id: initial.id })
              }
            >
              Eliminar
            </button>
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
            <span>NUEVO REGISTRO</span>
            <h2>{title}</h2>
          </div>
          <button onClick={close}>×</button>
        </header>
        {children}
      </section>
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
function Quick({
  icon,
  label,
  action,
}: {
  icon: string;
  label: string;
  action: () => void;
}) {
  return (
    <button onClick={action}>
      <i>{icon}</i>
      <span>{label}</span>
    </button>
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
