/* eslint-disable @typescript-eslint/ban-ts-comment -- Legacy migration accepts heterogeneous SQLite/cloud rows. */
// @ts-nocheck -- Legacy migration adapter for heterogeneous SQLite/cloud row shapes.
import { cloudDb } from "@/lib/cloudflare/supabase-compat";
import { userFromBearer } from "@/lib/cloudflare/auth";
import { createHash } from "node:crypto";

const TABLES = [
  "calculations", "products", "product_profiles", "inventory_balances",
  "inventory_movements", "team", "clients", "invoices", "invoice_items",
  "payments", "cash_movements", "suppliers", "purchases", "protocols",
  "internal_withdrawals", "internal_withdrawal_payments", "supplier_payments",
  "legacy_sales", "app_settings",
];
// Lo transaccional debe viajar primero. Las cuentas personales se alimentan de
// estas filas por seller_id; catálogo y configuración nunca deben impedir que
// una venta asignada llegue a su vendedor.
const ADMIN_SYNC_ORDER = [
  "calculations", "products", "product_profiles", "team", "clients", "invoices",
  "invoice_items", "payments", "cash_movements", "legacy_sales",
  "inventory_balances", "inventory_movements", "suppliers", "purchases", "protocols",
  "internal_withdrawals", "internal_withdrawal_payments", "supplier_payments",
  "app_settings",
];

type Row = Record<string, unknown>;
const num = (value: unknown) => Number(value || 0);
const str = (value: unknown) => String(value ?? "");
const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as {message?: unknown}).message || "Error de base de datos");
  return String(error || "Error de base de datos");
};
const conflictFields: Record<string, string[]> = {
  product_profiles: ["product_id"],
  inventory_balances: ["product_id", "location"],
  app_settings: ["key"],
};
const rowKey = (table: string, row: Row) => (conflictFields[table] || ["id"]).map(key => str(row[key])).join("\u001f");
const comparable = (row: Row) => Object.fromEntries(Object.entries(row)
  .filter(([key]) => key !== "updated_at")
  .map(([key, value]) => [key, value == null ? null : value]));
const sameRow = (incoming: Row, current: Row) => {
  const left = comparable(incoming), right = comparable(current);
  return Object.keys(left).every(key => JSON.stringify(left[key]) === JSON.stringify(right[key]));
};
async function upsertChanged(table: string, rows: Row[], existingRows?: Row[]) {
  if (!rows.length) return 0;
  // Windows no incluye la imagen binaria en el snapshot general. Una clave
  // vacía significa "conservar la foto actual", no borrarla ni reescribirla.
  const effectiveRows = table === "product_profiles"
    ? rows.map(row => { const copy={...row}; if (!str(copy.photo_key)) delete copy.photo_key; return copy; })
    : rows;
  const current = existingRows || await all(table);
  const byKey = new Map(current.map(row => [rowKey(table, row), row]));
  const changed = effectiveRows.filter(row => {
    const old = byKey.get(rowKey(table, row));
    return !old || !sameRow(row, old);
  });
  if (!changed.length) return 0;
  const {error} = await cloudDb.from(table).upsert(changed, {onConflict:(conflictFields[table] || ["id"]).join(",")});
  if (error) throw error;
  return changed.length;
}

async function all(table: string) {
  const { data, error } = await cloudDb.from(table).select("*");
  if (error) throw error;
  return (data || []) as Row[];
}

async function reconcileInvoiceBalances() {
  const [invoices, payments] = await Promise.all([all("invoices"), all("payments")]);
  const paidByInvoice = new Map<number, number>();
  const paymentCount = new Map<number, number>();
  for (const payment of payments) {
    const invoiceId=num(payment.invoice_id);
    paidByInvoice.set(invoiceId,(paidByInvoice.get(invoiceId)||0)+num(payment.applied_usd));
    paymentCount.set(invoiceId,(paymentCount.get(invoiceId)||0)+1);
  }
  let repaired=0;
  for(const invoice of invoices){
    const id=num(invoice.id);if(!paymentCount.get(id))continue;
    const total=Math.max(0,num(invoice.total)),paid=Math.min(total,Math.max(0,paidByInvoice.get(id)||0)),balance=Math.max(0,total-paid),status=balance<=.005?"Pagada":paid>.005?"Parcial":"Pendiente";
    if(Math.abs(num(invoice.paid)-paid)<=.005&&Math.abs(num(invoice.balance)-balance)<=.005&&str(invoice.status)===status)continue;
    const {error}=await cloudDb.from("invoices").update({paid,balance,status,updated_at:new Date().toISOString()}).eq("id",id);
    if(error)throw error;repaired++;
  }
  return repaired;
}

async function pruneMissingInvoiceItems(invoices: Row[], items: Row[]) {
  if(!invoices.length)return 0;
  const invoiceIds=new Set(invoices.map(row=>num(row.id))),incomingIds=new Set(items.map(row=>num(row.id)));
  const stale=(await all("invoice_items")).filter(row=>invoiceIds.has(num(row.invoice_id))&&!incomingIds.has(num(row.id))).map(row=>num(row.id));
  if(!stale.length)return 0;
  const {error}=await cloudDb.from("invoice_items").delete().in("id",stale);if(error)throw error;
  return stale.length;
}

const productIdentity=(row:Row)=>`${str(row.name).trim().toLocaleLowerCase()}\u001f${str(row.concentration).replace(/\s+/g,"").toLocaleLowerCase()}`;

async function dedupeCloudProducts(){
  const products=await all("products"),groups=new Map<string,Row[]>();
  for(const product of products){const key=productIdentity(product);groups.set(key,[...(groups.get(key)||[]),product]);}
  let changed=0;
  for(const rows of groups.values()){
    if(rows.length<2)continue;
    rows.sort((a,b)=>num(a.id)-num(b.id));const canonical=rows[0],canonicalId=num(canonical.id);
    for(const duplicate of rows.slice(1)){
      const duplicateId=num(duplicate.id);
      for(const table of ["invoice_items","inventory_movements","protocols","internal_withdrawals","legacy_sales"]){
        const {error}=await cloudDb.from(table).update({product_id:canonicalId}).eq("product_id",duplicateId);if(error)throw error;
      }
      const balances=(await all("inventory_balances")).filter(row=>num(row.product_id)===duplicateId);
      const currentBalances=await all("inventory_balances");
      for(const balance of balances){
        const current=currentBalances.find(row=>num(row.product_id)===canonicalId&&str(row.location)===str(balance.location));
        if(current){const {error}=await cloudDb.from("inventory_balances").update({quantity:num(current.quantity)+num(balance.quantity)}).eq("product_id",canonicalId).eq("location",str(balance.location));if(error)throw error;}
        else {const {error}=await cloudDb.from("inventory_balances").update({product_id:canonicalId}).eq("product_id",duplicateId).eq("location",str(balance.location));if(error)throw error;}
      }
      for(const table of ["product_profiles","inventory_balances"]){const {error}=await cloudDb.from(table).delete().eq("product_id",duplicateId);if(error)throw error;}
      const {error}=await cloudDb.from("products").delete().eq("id",duplicateId);if(error)throw error;changed++;
    }
  }
  return changed;
}

async function normalizeIncomingProducts(supplied:Record<string,Row[]>){
  const existing=await all("products"),canonicalByIdentity=new Map(existing.map(row=>[productIdentity(row),num(row.id)]));
  const aliases=new Map<number,number>(),products=new Map<number,Row>();
  for(const row of supplied.products||[]){
    const key=productIdentity(row),incomingId=num(row.id),canonicalId=canonicalByIdentity.get(key)||incomingId;
    canonicalByIdentity.set(key,canonicalId);aliases.set(incomingId,canonicalId);products.set(canonicalId,{...row,id:canonicalId});
  }
  supplied.products=[...products.values()];
  for(const table of ["product_profiles","inventory_balances","inventory_movements","invoice_items","protocols","internal_withdrawals","legacy_sales"]){
    for(const row of supplied[table]||[])if(aliases.has(num(row.product_id)))row.product_id=aliases.get(num(row.product_id));
  }
  for(const table of ["product_profiles","inventory_balances"]){
    const unique=new Map<string,Row>();
    for(const row of supplied[table]||[]){const key=rowKey(table,row),old=unique.get(key);unique.set(key,table==="inventory_balances"&&old?{...row,quantity:num(old.quantity)+num(row.quantity)}:row);}
    supplied[table]=[...unique.values()];
  }
}

function personalTables(tables: Record<string, Row[]>, teamId: number) {
  const invoices = tables.invoices.filter(row => num(row.seller_id) === teamId);
  const invoiceIds = new Set(invoices.map(row => num(row.id)));
  const clientIds = new Set(invoices.map(row => num(row.client_id)));
  const clients = tables.clients.filter(row => num(row.owner_team_id) === teamId || clientIds.has(num(row.id)));
  const profiles = tables.product_profiles.map(row => { const visible = { ...row }; delete visible.unit_cost; delete visible.calculation_id; delete visible.wholesale_mg_price; return visible; });
  return {
    calculations: [],
    products: tables.products,
    product_profiles: profiles,
    inventory_balances: tables.inventory_balances.filter(row => str(row.location) === `VENDEDOR:${teamId}`),
    inventory_movements: [],
    team: tables.team.filter(row => num(row.id) === teamId),
    clients,
    invoices,
    invoice_items: tables.invoice_items.filter(row => invoiceIds.has(num(row.invoice_id))),
    payments: tables.payments.filter(row => invoiceIds.has(num(row.invoice_id))),
    // Los cobros creados desde facturas antiguas no siempre tienen partner_id;
    // la factura enlazada es la fuente de propiedad más fiable.
    cash_movements: tables.cash_movements.filter(row =>
      invoiceIds.has(num(row.invoice_id)) || num(row.partner_id) === teamId),
    suppliers: [], purchases: [], protocols: tables.protocols,
    internal_withdrawals: [], internal_withdrawal_payments: [], supplier_payments: [],
    legacy_sales: tables.legacy_sales.filter(row => num(row.seller_id) === teamId),
    app_settings: tables.app_settings.filter(row => str(row.key).startsWith("lealtad_") ||
      ["mobile_data_revision", "retencion_utilidad", "ganancia_por_socio"].includes(str(row.key))),
  };
}

export async function GET(request: Request) {
  const user = await userFromBearer(request);
  if (!user) return Response.json({ error: "No autorizado" }, { status: 403 });
  if (user.role !== "admin" && !user.team_id) return Response.json({ error: "La cuenta no está vinculada a un integrante" }, { status: 403 });
  const cloud = cloudDb;
  try {
    if (new URL(request.url).searchParams.get("revision") === "1") {
      const {data,error}=await cloud.from("app_settings").select("value").eq("key","mobile_data_revision").maybeSingle();
      if(error)throw error;
      return Response.json({revision:data?.value||""});
    }
    const entries = await Promise.all(TABLES.map(async table => {
      const { data, error } = await cloud.from(table).select("*");
      if (error) throw error;
      return [table, data || []] as const;
    }));
    let tables = Object.fromEntries(entries) as Record<string, Row[]>;
    const revision = tables.app_settings.find((x: Record<string, unknown>) => x.key === "mobile_data_revision")?.value || "";
    if (user.role !== "admin") tables = personalTables(tables, Number(user.team_id));
    return Response.json({ schema: 2, generatedAt: new Date().toISOString(), revision, user: { email:user.email, role:user.role, teamId:user.team_id }, tables });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo preparar la sincronización" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await userFromBearer(request);
  if (!user) return Response.json({ error: "No autorizado" }, { status: 403 });
  if (user.role !== "admin" && !user.team_id) return Response.json({ error: "La cuenta no está vinculada a un integrante" }, { status: 403 });
  let stage = "leer la solicitud";
  try {
    const payload = await request.json() as { replace?: boolean; tables?: Record<string, Record<string, unknown>[]>; deletions?: {table:string;id:number}[]; image?: {productId:number,name:string,type:string,data:string} };
    if (payload.image) {
      if (user.role !== "admin") return Response.json({error:"Solo administración puede cambiar imágenes"},{status:403});
      const image=payload.image,extension=(payload.image.name.match(/\.(png|jpe?g|webp)$/i)?.[0]||".png").toLowerCase();
      const bytes=Buffer.from(image.data,"base64"),digest=createHash("sha256").update(bytes).digest("hex").slice(0,16),key=`product-${payload.image.productId}-${digest}${extension}`;
      if(bytes.length>8*1024*1024) return Response.json({error:"La imagen supera 8 MB"},{status:400});
      const upload=await fetch(`${process.env.PEPTIBRA_API_URL}/files/${encodeURIComponent(key)}`,{method:"PUT",headers:{"content-type":image.type||"image/png","x-peptibra-key":process.env.PEPTIBRA_API_SECRET!},body:bytes});if(!upload.ok)throw new Error("No se pudo subir la imagen");
      const now=new Date().toISOString(),{data:source,error:sourceError}=await cloudDb.from("products").select("name").eq("id",image.productId).maybeSingle();if(sourceError)throw sourceError;const {data:family,error:familyError}=await cloudDb.from("products").select("id").eq("name",source?.name||"");if(familyError)throw familyError;const familyIds=(family||[]).map(row=>Number(row.id));const {data:oldProfiles}=familyIds.length?await cloudDb.from("product_profiles").select("photo_key").in("product_id",familyIds):{data:[]};
      const {error:update}=await cloudDb.from("product_profiles").update({photo_key:key}).in("product_id",familyIds.length?familyIds:[image.productId]);if(update)throw update;
      for(const old of new Set((oldProfiles||[]).map(row=>String(row.photo_key||"")).filter(old=>old&&old!==key))){await fetch(`${process.env.PEPTIBRA_API_URL}/files/${encodeURIComponent(old)}`,{method:"DELETE",headers:{"x-peptibra-key":process.env.PEPTIBRA_API_SECRET!}}).catch(()=>undefined)}
      const {error:revisionError}=await cloudDb.from("app_settings").upsert({key:"mobile_data_revision",value:now,updated_at:now},{onConflict:"key"});if(revisionError)throw revisionError;
      return Response.json({ok:true,key,revision:now});
    }
    const supplied = payload.tables || {};
    const allowed = new Set(TABLES);
    let changedRows = 0;
    for (const deletion of payload.deletions || []) {
      if (!Number.isFinite(Number(deletion.id))) continue;
      if(deletion.table==="products"){
        if(user.role!=="admin")return Response.json({error:"Solo administración puede eliminar productos"},{status:403});
        const productId=Number(deletion.id);
        stage=`archivar producto ${productId}`;
        const {error}=await cloudDb.from("products").update({status:"archived",updated_at:new Date().toISOString()}).eq("id",productId);
        if(error)throw error;
        changedRows++;
        continue;
      }
      if(deletion.table==="cash_movements"){
        const movementId=Number(deletion.id),{data:movement,error:movementError}=await cloudDb.from("cash_movements").select("id,partner_id,invoice_id,category").eq("id",movementId).maybeSingle();
        if(movementError)throw movementError;
        if(!movement)continue;
        if(user.role!=="admin"&&num(movement.partner_id)!==num(user.team_id))return Response.json({error:"No puedes eliminar un movimiento ajeno"},{status:403});
        if(str(movement.category)!=="Compra / inversión de socio")return Response.json({error:"Esta baja debe realizarse desde su módulo de origen"},{status:400});
        stage=`eliminar compra o inversión ${movementId}`;
        const {error}=await cloudDb.from("cash_movements").delete().eq("id",movementId);if(error)throw error;
        changedRows++;continue;
      }
      if (deletion.table !== "invoices") continue;
      const invoiceId=Number(deletion.id),{data:invoice,error:invoiceError}=await cloudDb.from("invoices").select("id,number,seller_id").eq("id",invoiceId).maybeSingle();
      if(invoiceError)throw invoiceError;
      if(!invoice)continue;
      if(user.role!=="admin"&&num(invoice.seller_id)!==num(user.team_id))return Response.json({error:"No puedes eliminar una factura ajena"},{status:403});
      stage=`eliminar factura ${invoiceId}`;
      for(const table of ["cash_movements","payments","invoice_items"]){const {error}=await cloudDb.from(table).delete().eq("invoice_id",invoiceId);if(error)throw error;}
      const {error:saleError}=await cloudDb.from("legacy_sales").delete().eq("notes",`Factura ${str(invoice.number)}`);if(saleError)throw saleError;
      const {error:invoiceDeleteError}=await cloudDb.from("invoices").delete().eq("id",invoiceId);if(invoiceDeleteError)throw invoiceDeleteError;
      changedRows++;
    }
    // La carga de Windows ya contiene identificadores estables. Un upsert es
    // suficiente y, a diferencia de borrar primero, no puede eliminar ventas
    // de otra PC o de una cuenta personal durante una sincronización parcial.
    if (user.role === "admin") {
      stage="consolidar productos duplicados";
      changedRows += await dedupeCloudProducts();
      await normalizeIncomingProducts(supplied);
      stage="conciliar renglones de facturas";
      changedRows += await pruneMissingInvoiceItems(supplied.invoices||[],supplied.invoice_items||[]);
      for(const table of ADMIN_SYNC_ORDER){const rows=supplied[table]||[];if(!allowed.has(table)||!rows.length)continue;stage=`actualizar ${table}`;changedRows += await upsertChanged(table, rows);}
    } else {
      const teamId = Number(user.team_id), location = `VENDEDOR:${teamId}`;
      const existingInvoices = await all("invoices");
      const ownedInvoiceIds = new Set(existingInvoices.filter(row => num(row.seller_id) === teamId).map(row => num(row.id)));
      for (const row of supplied.invoices || []) {
        const id = num(row.id), existing = existingInvoices.find(item => num(item.id) === id);
        if (existing && num(existing.seller_id) !== teamId) return Response.json({error:"Conflicto de identidad en una factura ajena"},{status:409});
        row.seller_id = teamId; ownedInvoiceIds.add(id);
      }
      const existingClients = await all("clients");
      for (const row of supplied.clients || []) {
        const existing = existingClients.find(item => num(item.id) === num(row.id));
        if (existing && num(existing.owner_team_id) && num(existing.owner_team_id) !== teamId) {
          return Response.json({error:"No puedes modificar un cliente asignado a otra cuenta"},{status:403});
        }
        row.owner_team_id = teamId;
      }
      for (const table of ["invoice_items", "payments"] as const) {
        const existingRows = await all(table);
        for (const row of supplied[table] || []) {
          const existing = existingRows.find(item => num(item.id) === num(row.id));
          if (existing && !ownedInvoiceIds.has(num(existing.invoice_id))) {
            return Response.json({error:`Conflicto de identidad en ${table}`},{status:409});
          }
        }
      }
      for (const [table, ownerField] of [["cash_movements", "partner_id"], ["legacy_sales", "seller_id"]] as const) {
        const existingRows = await all(table);
        let nextPersonalId = Math.max(teamId * 10_000_000,
          ...existingRows.map(row => num(row.id))) + 1;
        for (const row of supplied[table] || []) {
          const existing = existingRows.find(item => num(item.id) === num(row.id));
          const existingBelongsToTeam = table === "cash_movements"
            ? ownedInvoiceIds.has(num(existing?.invoice_id)) || num(existing?.partner_id) === teamId
            : num(existing?.[ownerField]) === teamId;
          if (existing && !existingBelongsToTeam) {
            // Bases creadas antes del espacio de IDs personales pueden repetir
            // un autonumérico de otra cuenta. Reasignar conserva ambos registros
            // y evita bloquear toda la sincronización por una fila secundaria.
            row.id = nextPersonalId++;
          }
        }
      }
      const safe: Record<string, Row[]> = {
        clients: supplied.clients || [],
        invoices: supplied.invoices || [],
        invoice_items: (supplied.invoice_items || []).filter(row => ownedInvoiceIds.has(num(row.invoice_id))),
        payments: (supplied.payments || []).filter(row => ownedInvoiceIds.has(num(row.invoice_id))),
        inventory_balances: (supplied.inventory_balances || []).filter(row => str(row.location) === location),
        cash_movements: (supplied.cash_movements || []).filter(row =>
          ownedInvoiceIds.has(num(row.invoice_id)) || num(row.partner_id) === teamId),
        legacy_sales: (supplied.legacy_sales || []).filter(row => num(row.seller_id) === teamId),
      };
      stage="conciliar renglones de facturas";
      changedRows += await pruneMissingInvoiceItems(safe.invoices,safe.invoice_items);
      for (const [table, rows] of Object.entries(safe)) {
        if (!rows.length) continue;
        stage = `actualizar ${table}`;
        changedRows += await upsertChanged(table, rows);
      }
      // El saldo de lealtad se deriva de operaciones verificables. La cuenta
      // personal nunca puede escribir porcentajes arbitrarios en app_settings.
      stage = "recalcular lealtad";
      const [allInvoices, allClients, allSettings] = await Promise.all([all("invoices"), all("clients"), all("app_settings")]);
      const rate = Math.max(0, Math.min(100, num(allSettings.find(row => row.key === "lealtad_descuento_pct")?.value) || 10));
      const events: Row[] = [];
      for (const invoice of [...allInvoices].sort((a,b) => `${a.created_at}|${a.id}`.localeCompare(`${b.created_at}|${b.id}`))) {
        if (num(invoice.loyalty_discount_pct) > 0) events.push({key:`redeem:${invoice.id}`,type:"redeem",client_id:num(invoice.client_id),pct:num(invoice.loyalty_discount_pct),date:str(invoice.created_at)});
        else if (num(invoice.discount) <= .005) events.push({key:`purchase:${invoice.id}`,type:"purchase",client_id:num(invoice.client_id),pct:rate,date:str(invoice.created_at)});
      }
      for (const client of allClients) if (num(client.referred_by_client_id)) events.push({key:`referral:${client.id}`,type:"referral",client_id:num(client.referred_by_client_id),pct:rate,date:str(client.created_at)});
      const ledgerAt = new Date().toISOString();
      changedRows += await upsertChanged("app_settings", [
        {key:"lealtad_movimientos_json",value:JSON.stringify(events),updated_at:ledgerAt},
        {key:"lealtad_ledger_v1",value:"1",updated_at:ledgerAt},
      ], allSettings);
    }
    stage = "conciliar pagos y facturas";
    changedRows += await reconcileInvoiceBalances();
    if (!changedRows) {
      const {data}=await cloudDb.from("app_settings").select("value").eq("key","mobile_data_revision").maybeSingle();
      return Response.json({ok:true,unchanged:true,revision:data?.value||""});
    }
    stage = "confirmar la revisión";
    const revision=new Date().toISOString();const {error}=await cloudDb.from("app_settings").upsert({key:"mobile_data_revision",value:revision,updated_at:revision},{onConflict:"key"});if(error)throw error;
    return Response.json({ ok: true, revision });
  } catch (error) {
    const detail = errorMessage(error);
    console.error("desktop-sync POST", {stage, detail, role:user.role, teamId:user.team_id});
    return Response.json({ error: `Error al ${stage}: ${detail}` }, { status: 500 });
  }
}
