import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("la sincronización personal incluye caja enlazada a sus facturas", async () => {
  const source = await read("app/api/desktop-sync/route.ts");
  assert.match(source, /invoiceIds\.has\(num\(row\.invoice_id\)\) \|\| num\(row\.partner_id\) === teamId/);
  assert.match(source, /row\.id = nextPersonalId\+\+/);
  assert.match(source, /ownedInvoiceIds\.has\(num\(existing\?\.invoice_id\)\)/);
  assert.match(source, /pruneMissingInvoiceItems/);
  assert.match(source, /reconcileInvoiceBalances/);
});

test("Windows siempre descarga la conciliación después de subir cambios", async () => {
  const source = await read("../app.py");
  assert.match(source, /if remote_changed or local_changed:/);
  assert.match(source, /pull_mobile_cloud_data\(interactive=interactive,snapshot=snapshot,force=True\)/);
  assert.match(source, /Más vendidos/);
});

test("la oficina virtual calcula finanzas para administración y socios", async () => {
  const source = await read("app/api/mobile/route.ts");
  assert.match(source, /user\.role==="admin"\|\|user\.role==="socio"/);
  assert.match(source, /visibleCash=cash\.filter\(x=>invoiceIds\.has/);
  assert.match(source, /invoicePayments\.reduce/);
});

test("Contacto conserva el encabezado oscuro compartido", async () => {
  const [contact, css] = await Promise.all([read("app/contact/page.tsx"), read("app/globals.css")]);
  assert.doesNotMatch(contact, /background:\s*["']?#fff/i);
  assert.match(css, /\.pb-header/);
});

test("la oficina unificada mantiene nombres, inventario y formularios coherentes", async () => {
  const [office, api, language] = await Promise.all([
    read("app/ptbr-mobile/MobileOffice.tsx"),
    read("app/api/mobile/route.ts"),
    read("app/LanguageProvider.tsx"),
  ]);
  assert.match(office, /Buscar cliente por nombre/);
  assert.match(office, /action="\+ Nuevo protocolo"/);
  assert.match(office, /post\("deleteProtocol", \{ id: p\.id \}\)/);
  assert.match(office, /safeView === "inventory" \? \(\s*Inventory\(\)/);
  assert.match(office, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.doesNotMatch(office, /title="Calculadora"/);
  assert.match(office, /SKU automático/);
  assert.match(office, /String\(x\.location\) === inventoryLocation/);
  assert.match(api, /const cleanInvoiceItems=/);
  assert.match(api, /baseSku=`PTBR-/);
  assert.match(language, /path\.startsWith\("\/office"\)/);
  assert.match(office, /Correo para acceso \(opcional\)/);
  assert.match(office, /fetch\("\/api\/desktop-users"/);
  assert.match(api, /insert\(\{\.\.\.values,created_at:now\}\)\.select\("id"\)\.single\(\)/);
});

test("las credenciales nuevas comienzan con inventario personal en cero", async () => {
  const source = await read("app/api/desktop-users/route.ts");
  assert.match(source, /const location=`VENDEDOR:\$\{teamId\}`/);
  assert.match(source, /quantity:0/);
  assert.match(source, /onConflict:"product_id,location"/);
});

test("la interfaz evita botones superpuestos y compacta la lista de precios", async () => {
  const [officeCss, priceList, priceCss, launcher] = await Promise.all([
    read("app/ptbr-mobile/mobile-enhancements.css"),
    read("app/ptbr-mobile/price-list/PriceList.tsx"),
    read("app/ptbr-mobile/price-list/price-list.css"),
    read("../windows_launcher.py"),
  ]);
  assert.match(officeCss, /minmax\(116px,132px\)/);
  assert.match(officeCss, /@media\(max-width:620px\)/);
  assert.match(priceList, /index \+= 9/);
  assert.match(priceCss, /repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(priceCss, /grid-auto-rows:minmax\(0,1fr\)/);
  assert.match(launcher, /maximized=True/);
  assert.match(launcher, /Peptibra - Gestión de Ventas/);
  assert.match(launcher, /monthyva-wordmark-brand\.png/);
});

test("la lista de precios muestra descripciones completas y el programa de lealtad", async () => {
  const [priceList, css] = await Promise.all([
    read("app/ptbr-mobile/price-list/PriceList.tsx"),
    read("app/ptbr-mobile/price-list/price-list.css"),
  ]);
  assert.match(priceList, /PROGRAMA DE LEALTAD/);
  assert.match(priceList, /5% de descuento/);
  assert.match(priceList, /15% de descuento/);
  assert.match(priceList, /20% permanente/);
  assert.match(priceList, /cada 10 clientes referidos/i);
  assert.doesNotMatch(css, /-webkit-line-clamp/);
  assert.match(css, /overflow:visible/);
  assert.match(css, /\.price-loyalty/);
});

test("la factura puede cancelarse y la lista de precios promueve el centro de COAs", async () => {
  const [office, priceList, printShared] = await Promise.all([
    read("app/ptbr-mobile/MobileOffice.tsx"),
    read("app/ptbr-mobile/price-list/PriceList.tsx"),
    read("app/ptbr-mobile/print-shared.tsx"),
  ]);
  assert.match(office, /className="invoice-form-actions"/);
  assert.match(office, />Cancelar<\/button>/);
  assert.match(priceList, /CALIDAD Y TRAZABILIDAD/);
  assert.match(priceList, /peptibra\.com\/coas/);
  assert.match(printShared, /document\.body\.appendChild\(link\)/);
  assert.match(printShared, /Preparando PDF…/);
});

test("el porcentaje de reposición es solo una recomendación y no reduce ganancias disponibles", async () => {
  const [office, api, settings] = await Promise.all([
    read("app/ptbr-mobile/MobileOffice.tsx"),
    read("app/api/mobile/route.ts"),
    read("app/ptbr-mobile/settings/settings-client.tsx"),
  ]);
  assert.match(office, /Recomendación para reponer/);
  assert.match(office, /no se descuenta\s*ni se aparta automáticamente/);
  assert.match(api, /distributable=Math\.max\(0,Math\.min\(realizedNet-distributed,liquidAvailable\)\)/);
  assert.match(settings, /Porcentaje recomendado para reponer inventario/);
});

test("las notificaciones reúnen seguimientos de 30 días y cobros vencidos", async () => {
  const [office, api, css] = await Promise.all([
    read("app/ptbr-mobile/MobileOffice.tsx"),
    read("app/api/mobile/route.ts"),
    read("app/globals.css"),
  ]);
  assert.match(office, /Seguimiento de recompra/);
  assert.match(office, /days<30/);
  assert.match(office, /days>15\?"Factura vencida"/);
  assert.match(office, /notification-button/);
  assert.match(office, /realizó una nueva venta/);
  assert.match(office, /LOGRO DEL EQUIPO/);
  assert.match(office, /team-sale:/);
  assert.match(api, /saveNotificationReads/);
  assert.match(api, /notification_reads:/);
  assert.match(api, /saveNotificationDismissed/);
  assert.match(api, /notification_dismissed:/);
  assert.match(office, /title="Eliminar notificación"/);
  assert.match(office, /<TrashIcon\/>/);
  assert.match(css, /\.notification-center/);
});

test("el inicio muestra los productos más vendidos del mes seleccionado", async () => {
  const [office, css] = await Promise.all([
    read("app/ptbr-mobile/MobileOffice.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(office, /monthProductUnits/);
  assert.match(office, /Productos más vendidos/);
  assert.match(office, /monthInvoiceIds\.has/);
  assert.match(office, /topProducts\.map/);
  assert.match(css, /\.top-products-panel/);
});

test("Caja elimina en lote y filtra sus indicadores por mes, año o historial", async () => {
  const [office, api, css, mobileCss] = await Promise.all([
    read("app/ptbr-mobile/MobileOffice.tsx"),
    read("app/api/mobile/route.ts"),
    read("app/globals.css"),
    read("app/ptbr-mobile/mobile-enhancements.css"),
  ]);
  assert.match(office, /Seleccionar todos los borrables/);
  assert.match(office, /post\("deleteCashMovements", \{ ids: selectedCashIds \}\)/);
  assert.doesNotMatch(office, /¿Eliminar este movimiento manual\?/);
  assert.match(api, /action==="deleteCashMovements"/);
  assert.match(api, /movement\.invoice_id\|\|movement\.withdrawal_id\|\|movement\.purchase_id/);
  assert.match(css, /\.cash-bulk-toolbar/);
  assert.match(office, /Ventas totales · \{rangeLabel\}/);
  assert.match(office, /cashRange==="month"/);
  assert.match(office, /cashRange==="year"/);
  assert.match(office, /cashRange==="all"/);
  assert.match(office, /periodInvoices\.reduce/);
  assert.match(office, /Cobrado de esas ventas/);
  assert.match(mobileCss, /\.cash-period-filter/);
});

test("el dashboard filtra por mes y señala facturas vencidas", async () => {
  const [office, css] = await Promise.all([
    read("app/ptbr-mobile/MobileOffice.tsx"),
    read("app/ptbr-mobile/mobile-enhancements.css"),
  ]);
  assert.match(office, /type="month"/);
  assert.match(office, /Ventas del mes/);
  assert.match(office, /Cobrado de esas facturas/);
  assert.match(office, /periodInvoices=invoices\.filter\(invoice=>rowMonth\(invoice\)===reportMonth\)/);
  assert.match(office, /Total facturado/);
  assert.match(office, /Total cobrado/);
  assert.match(office, /Facturas de \$\{monthLabel\}/);
  assert.match(css, /\.sales-period-totals/);
  assert.match(office, /isInvoiceOverdue/);
  assert.match(office, /más de 15 días pendiente de pago/);
  assert.match(css, /\.dashboard-period/);
  assert.match(css, /\.overdue-bell/);
});

test("la regla de Agua BAC y la tasa DOP se administran centralmente", async () => {
  const [settings, catalog, cart, mobileApi, rateApi, office] = await Promise.all([
    read("app/ptbr-mobile/settings/settings-client.tsx"),
    read("app/api/catalog/route.ts"),
    read("app/products/ProductCatalog.tsx"),
    read("app/api/mobile/route.ts"),
    read("app/api/exchange-rate/route.ts"),
    read("app/ptbr-mobile/MobileOffice.tsx"),
  ]);
  assert.match(settings, /bac_free_enabled/);
  assert.match(settings, /bac_free_threshold_usd/);
  assert.match(catalog, /bacOffer/);
  assert.match(cart, /complimentary/);
  assert.match(cart, /eligibleTotal>bacOffer\.threshold/);
  assert.match(mobileApi, /grantFreeBac=freeBacEnabled&&totals\.total>freeBacThreshold/);
  assert.match(rateApi, /www\.infodolar\.com\.do/);
  assert.match(rateApi, /dop_rate_date/);
  assert.match(office, /fetch\("\/api\/exchange-rate"\)/);
});

test("la factura descuenta inventario y sugiere complementos sin obligarlos", async () => {
  const [api, office] = await Promise.all([
    read("app/api/mobile/route.ts"),
    read("app/ptbr-mobile/MobileOffice.tsx"),
  ]);
  assert.match(api, /invoice_inventory_location:\$\{invoiceId\}/);
  assert.match(api, /admin_inventory_team_id/);
  assert.match(api, /const location=`VENDEDOR:\$\{ownerTeamId\}`/);
  assert.match(office, /access\.inventoryTeamId/);
  assert.match(api, /const paidBacAdded=0/);
  assert.doesNotMatch(api, /prepared\.push\(\{productId:bacId,quantity:paidBacAdded/);
  assert.match(api, /prellenad\|pre-filled/);
  assert.match(office, /Total antes de facturar/);
  assert.match(office, /Descuento manual/);
  assert.doesNotMatch(office, /Aplicar descuento\s*progresivo/);
  assert.doesNotMatch(api, /progressiveRate/);
  assert.match(api, /loyaltyRate=manualValue<=\.005/);
  assert.match(office, /Cancelar: continuar y guardar sin agregarlos/);
  assert.match(office, /complementRequired=previewLines\.reduce/);
  assert.match(office, /localeCompare\(`\$\{String\(b\.name\)\} \$\{String\(b\.concentration\)\}`/);
  assert.match(office, /Hay plumas disponibles/);
  assert.match(office, /Continuar sin agregar pluma/);
  assert.match(office, /Total disponible/);
  assert.match(office, /Presentaciones activas/);
});

test("Cobrar filtra solo saldos pendientes y la lealtad reconoce productos gratis por referidos", async () => {
  const [api, office, invoicePrint] = await Promise.all([
    read("app/api/mobile/route.ts"),
    read("app/ptbr-mobile/MobileOffice.tsx"),
    read("app/ptbr-mobile/invoices/[id]/InvoicePrint.tsx"),
  ]);
  assert.match(office, /const isInvoicePending/);
  assert.match(office, /salesFilter === "pending" \? periodInvoices\.filter\(isInvoicePending\)/);
  assert.match(api, /referral_free_products:active\?clientRewards\.length:0/);
  assert.match(api, /referral_free_products_available:active\?availableRewards:0/);
  assert.match(office, /Por cada 10 clientes referidos, se gana 1 producto gratis/);
  assert.match(invoicePrint, /discountLabel=discount>0/);
  assert.match(invoicePrint, /Intl\.DateTimeFormat\("es-DO"/);
});

test("cada factura congela su tasa DOP y los pagos reutilizan esa tasa", async () => {
  const [api, office, invoicePrint] = await Promise.all([
    read("app/api/mobile/route.ts"),
    read("app/ptbr-mobile/MobileOffice.tsx"),
    read("app/ptbr-mobile/invoices/[id]/InvoicePrint.tsx"),
  ]);
  assert.match(api, /invoice_fx:\$\{invoiceId\}/);
  assert.match(api, /totalDop=roundDop\(total\*invoiceRate\)/);
  assert.match(api, /const rate=fx\.rate,currency=/);
  assert.match(api, /Math\.abs\(original-expectedDop\)<=2\.5\?due/);
  assert.match(office, /Tasa archivada en la factura/);
  assert.match(office, /Esta tasa no cambia aunque el pago se realice otro día/);
  assert.match(invoicePrint, /TOTAL DOP/);
  assert.match(invoicePrint, /Tasa archivada/);
});

test("los permisos separan administración, inventario y protocolos personales", async () => {
  const [office, api] = await Promise.all([
    read("app/ptbr-mobile/MobileOffice.tsx"),
    read("app/api/mobile/route.ts"),
  ]);
  assert.match(office, /isAdmin && \(\s*<div className="inventory-admin-actions">/);
  assert.match(office, /isAdmin &&[\s\S]*setModal\("Editar producto"\)/);
  assert.match(api, /"saveTeam"/);
  assert.match(api, /"createProduct","updateProduct","saveProductFamily"/);
  assert.match(api, /location=user\.role==="admin"\?.*:`VENDEDOR:\$\{num\(user\.teamId\)\}`/);
  assert.match(api, /protocol_owner:\$\{id\}/);
  assert.match(api, /Solo puedes modificar los protocolos creados por tu cuenta/);
  assert.match(api, /Solo puedes eliminar los protocolos creados por tu cuenta/);
  assert.match(office, /Boolean\(p\.can_edit\)/);
  assert.match(office, /Boolean\(p\.can_delete\)/);
});

test("todos los documentos imprimibles generan y comparten un PDF multipágina", async () => {
  const shared = await read("app/ptbr-mobile/print-shared.tsx");
  assert.match(shared, /buildPdf/);
  assert.match(shared, /querySelectorAll\(captureSelector\)/);
  assert.match(shared, /application\/pdf/);
  assert.match(shared, /navigator\.canShare/);
  assert.match(shared, /navigator\.share\(shareData\)/);
  assert.match(shared, /Enviar PDF por WhatsApp/);
  assert.match(shared, /El PDF fue descargado/);
});

test("el PDF usa un lienzo A4 idéntico en móvil y escritorio", async () => {
  const [shared, globals, priceCss] = await Promise.all([
    read("app/ptbr-mobile/print-shared.tsx"),
    read("app/globals.css"),
    read("app/ptbr-mobile/price-list/price-list.css"),
  ]);
  assert.match(shared, /withFixedA4/);
  assert.match(shared, /pdf-capture-mode/);
  assert.match(shared, /Math\.max\(rect\.height,node\.scrollHeight\)/);
  assert.match(shared, /pixelRatio:1\.55/);
  assert.doesNotMatch(shared, /canvasWidth:/);
  assert.match(shared, /style:\{margin:"0",marginLeft:"0",marginRight:"0",left:"0"/);
  assert.match(globals, /\.pdf-capture-mode \.canonical-sheet\{width:210mm!important;height:297mm!important/);
  assert.match(priceCss, /\.pdf-capture-mode \.price-sheet \.price-grid/);
  assert.match(priceCss, /width:18mm;height:22mm/);
});

test("clientes separa ficha, edición y eliminación segura", async () => {
  const [office, api, css] = await Promise.all([
    read("app/ptbr-mobile/MobileOffice.tsx"),
    read("app/api/mobile/route.ts"),
    read("app/ptbr-mobile/mobile-enhancements.css"),
  ]);
  assert.match(office, /setModal\("Ficha del cliente"\)/);
  assert.match(office, /function ClientDetail/);
  assert.match(office, /Productos adquiridos/);
  assert.match(office, /client-row-actions/);
  assert.match(office, /post\("deleteClient"/);
  assert.match(office, /const TrashIcon/);
  assert.match(api, /action==="deleteClient"/);
  assert.match(api, /archivado para conservar sus facturas/);
  assert.match(css, /\.trash-button/);
  assert.match(css, /\.client-detail-metrics/);
});

test("facturación valida antes de mutar inventario y no admite cobros vacíos", async () => {
  const api = await read("app/api/mobile/route.ts");
  const stockCheck = api.indexOf("const requiredByProduct=new Map");
  const oldStockRestore = api.indexOf("if(invoiceId){for(const item of oldItems)await changeBalance");
  assert.ok(stockCheck >= 0 && oldStockRestore > stockCheck);
  assert.match(api, /Inventario insuficiente para/);
  assert.match(api, /El monto recibido debe ser mayor que cero/);
  assert.match(api, /Este retiro ya está pagado/);
  assert.match(api, /El monto pagado no puede exceder el total de la compra/);
});

test("los campos editables permiten reemplazar el cero sin producir 040", async () => {
  const office = await read("app/ptbr-mobile/MobileOffice.tsx");
  assert.match(office, /\[inventoryDrafts, setInventoryDrafts\]/);
  assert.match(office, /onFocus=\{\(event\) => event\.currentTarget\.select\(\)\}/);
  assert.match(office, /onBlur=\{\(event\) => setInventoryQuantity/);
  assert.match(office, /\[quantity, setQuantity\] = useState\("1"\)/);
  assert.match(office, /\[manualDiscountValue, setManualDiscountValue\] = useState\(\(\) => initial/);
});

test("editar factura restaura el descuento manual originalmente guardado", async () => {
  const [office, api] = await Promise.all([
    read("app/ptbr-mobile/MobileOffice.tsx"),
    read("app/api/mobile/route.ts"),
  ]);
  assert.match(api, /invoice_manual_discount:/);
  assert.match(api, /manual_discount_type:manual\.type/);
  assert.match(api, /manual_discount_value:manual\.value/);
  assert.match(api, /JSON\.stringify\(\{type:manualType,value:manualValue\}\)/);
  assert.match(office, /initial\?\.manual_discount_type/);
  assert.match(office, /initial\.manual_discount_value/);
});

test("cada producto puede exigir complementos por unidad y una factura nueva abre limpia", async () => {
  const [office, api] = await Promise.all([
    read("app/ptbr-mobile/MobileOffice.tsx"),
    read("app/api/mobile/route.ts"),
  ]);
  assert.match(office, /name="complementEnabled"/);
  assert.match(office, /name="complementProductId"/);
  assert.match(office, /name="complementQuantity"/);
  assert.match(office, /missingComplements/);
  assert.match(office, /setSelected\(null\); setModal\("Nueva factura"\)/);
  assert.match(api, /product_complement:/);
  assert.match(api, /requiredComplements/);
  assert.match(api, /item\.quantity\)\*Math\.max\(1,num\(item\.complementQuantity,1\)\)/);
});

test("equipo separa comisiones cobradas y pendientes y las facturas controlan entrega", async () => {
  const [office, api, css] = await Promise.all([
    read("app/ptbr-mobile/MobileOffice.tsx"),
    read("app/api/mobile/route.ts"),
    read("app/ptbr-mobile/mobile-enhancements.css"),
  ]);
  assert.match(api, /commission_pending_collection/);
  assert.match(api, /commission_paid/);
  assert.match(api, /commission_due/);
  assert.match(api, /action==="payInvoiceCommission"/);
  assert.match(api, /commission_payment/);
  assert.match(api, /action==="updateDeliveryStatus"/);
  assert.match(api, /action==="updateDeliveryStatusBulk"/);
  assert.match(api, /invoice_delivery:/);
  assert.match(office, /Comisión pendiente del cliente/);
  assert.match(office, /Comisión disponible por pagar/);
  assert.match(office, /Marcar entregada/);
  assert.match(office, /Pagar comisión/);
  assert.match(office, /wa\.me/);
  assert.match(office, /Seleccionar todas las visibles/);
  assert.match(office, /Marcar entregadas/);
  assert.match(office, /Marcar pendiente/);
  assert.match(css, /\.delivery-status-card/);
  assert.match(css, /\.commission-breakdown/);
});

test("el repositorio conserva los fuentes para compilar Windows sin la PC original", async () => {
  const [launcher, installer, workflow] = await Promise.all([
    read("windows/launcher.py"),
    read("windows/Peptibra.iss"),
    read(".github/workflows/windows-installer.yml"),
  ]);
  assert.match(launcher, /OFFICE_URL = "https:\/\/www\.peptibra\.com\/office"/);
  assert.match(launcher, /maximized=True/);
  assert.match(installer, /Peptibra-Setup-/);
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /upload-artifact@v4/);
});

test("los imprimibles envuelven textos variables y limitan filas de factura", async () => {
  const [invoice, protocol, resilience] = await Promise.all([
    read("app/ptbr-mobile/invoices/[id]/InvoicePrint.tsx"),
    read("app/ptbr-mobile/protocols/[id]/ProtocolPrint.tsx"),
    read("app/ptbr-mobile/print-resilience.css"),
  ]);
  assert.match(invoice, /Math\.ceil\(items\.length\/8\)/);
  assert.match(invoice, /print-resilience\.css/);
  assert.match(protocol, /print-resilience\.css/);
  assert.match(resilience, /overflow-wrap: anywhere/);
  assert.match(resilience, /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
});

test("la fase empresarial incorpora auditoría, lotes y canjes reales", async () => {
  const [schema, api, office, css] = await Promise.all([
    read("lib/enterprise-schema.ts"),
    read("app/api/mobile/route.ts"),
    read("app/ptbr-mobile/MobileOffice.tsx"),
    read("app/ptbr-mobile/mobile-enhancements.css"),
  ]);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS audit_log/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS inventory_lots/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS invoice_item_lots/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS loyalty_rewards/);
  assert.match(api, /action==="saveInventoryLot"/);
  assert.match(api, /action==="redeemReferralReward"/);
  assert.match(api, /pgDb\.batch/);
  assert.match(office, /function InventoryLotsForm/);
  assert.match(office, /function RewardRedemptionForm/);
  assert.match(office, /function AuditLog/);
  assert.match(css, /\.lot-manager/);
  assert.match(css, /\.audit-log/);
});

test("la oficina heredada duplicada fue retirada", async () => {
  await assert.rejects(read("app/admin/page.tsx"));
  await assert.rejects(read("app/admin/AdminDashboard.tsx"));
  await assert.rejects(read("app/api/products/route.ts"));
});

test("la guía subcutánea impresa usa ilustraciones premium de mujer y hombre", async () => {
  const [zones, css] = await Promise.all([
    read("app/ptbr-mobile/protocols/[id]/InjectionZones.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(zones, /subcutaneous-figures-v2\.png/);
  assert.match(zones, /MUJER · FRENTE/);
  assert.match(zones, /HOMBRE · ESPALDA/);
  assert.match(zones, /targets\.map/);
  assert.match(css, /\.zones-figure/);
  assert.match(css, /\.zone-target/);
});

test("los protocolos imprimibles cargan la fotografía del producto con fallback", async () => {
  const [protocol, css] = await Promise.all([
    read("app/ptbr-mobile/protocols/[id]/ProtocolPrint.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(protocol, /api\/catalog\/image\?key=/);
  assert.match(protocol, /onError=\{\(\)=>setFailed\(true\)\}/);
  assert.match(protocol, /<ProductPhoto product=\{product\}/);
  assert.match(css, /\.protocol-product-image img/);
});
