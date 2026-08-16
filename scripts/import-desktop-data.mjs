import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const source = process.argv[2];
if (!source) throw new Error("Indica el archivo JSON exportado.");
const { tables: d } = JSON.parse(fs.readFileSync(source, "utf8"));
const sql = postgres(process.env.POSTGRES_URL, { ssl: "require", max: 1, prepare: false });
const count = await sql`select count(*)::int as value from products`;
if (count[0].value !== 0) throw new Error("La nube ya contiene productos; se canceló para evitar duplicados.");

const iso = (value) => value ? String(value).replace(" ", "T") + (String(value).includes("T") ? "" : ":00") : new Date().toISOString();
const active = (value) => Number(value) ? 1 : 0;
const insert = async (tx, table, row) => {
  const clean = Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
  const columns = Object.keys(clean);
  const names = columns.map((name) => `"${name}"`).join(",");
  const params = columns.map((_, index) => `$${index + 1}`).join(",");
  await tx.unsafe(`insert into "${table}" (${names}) values (${params})`, Object.values(clean));
};
const calculations = new Map(d.calculos.map((x) => [x.id, x]));
const sellers = new Map(d.vendedores.map((x) => [x.id, x]));

await sql.begin(async (tx) => {
  await tx.unsafe(`create table if not exists legacy_sales (id bigint primary key, product_id bigint, seller_id bigint, partner_id bigint, quantity integer, unit_price real, total real, commission_pct real, commission_amount real, unit_cost real, total_cost real, notes text, created_at timestamptz)`);
  await tx.unsafe(`create table if not exists internal_withdrawals (id bigint primary key, number text, type text, team_id bigint, product_id bigint, quantity integer, unit_cost real, total_cost real, paid real, balance real, status text, notes text, created_at timestamptz)`);
  await tx.unsafe(`create table if not exists supplier_payments (id bigint primary key, purchase_id bigint, amount real, method text, created_at timestamptz)`);
  await tx.unsafe(`create table if not exists internal_withdrawal_payments (id bigint primary key, withdrawal_id bigint, amount real, method text, source text, created_at timestamptz)`);

  for (const x of d.calculos) await insert(tx,"calculations",{id:x.id,name:x.nombre,product_cost:x.costo_producto,shipping:x.envio,label_cost:x.etiqueta,packaging:x.empaque,bac_cost:x.costo_agua_bac,other_cost:x.otros,units:x.unidades,sale_price:x.precio_venta,includes_bac:active(x.incluye_bac)});
  for (const x of d.productos) {
    const stock=d.inventario.filter((i)=>i.producto_id===x.id).reduce((sum,i)=>sum+Number(i.cantidad||0),0);
    await insert(tx,"products",{id:x.id,name:x.nombre,sku:`PTBR-${String(x.id).padStart(4,"0")}`,category:x.nombre.includes("BAC")?"Agua bacteriostática":"Péptido",concentration:x.presentacion,stock,reorder_point:5,price:x.precio_normal||0,status:x.activo?"active":"archived",created_at:iso(x.creado),updated_at:iso(x.creado)});
    const c=calculations.get(x.calculo_id),unitCost=c&&Number(c.unidades)>0?(Number(c.costo_producto||0)+Number(c.envio||0)+Number(c.etiqueta||0)+Number(c.empaque||0)+Number(c.otros||0)+Number(c.costo_agua_bac||0))/Number(c.unidades):0;
    await insert(tx,"product_profiles",{product_id:x.id,description:x.descripcion||"",photo_key:x.foto?path.basename(x.foto):"",calculation_id:x.calculo_id||null,unit_cost:unitCost,normal_price:x.precio_normal||0,bac_price:x.precio_con_bac||0,wholesale_mg_price:x.precio_mayor_mg||0,wholesale_minimum:x.minimo_mayor||10});
  }
  for (const x of d.vendedores) await insert(tx,"team",{id:x.id,name:x.nombre,phone:x.telefono||"",role:x.categoria||"Vendedor",partner_id:x.socio_id||null,commission:x.comision||0,max_discount:x.descuento_max||0,notes:x.notas||"",active:active(x.activo),created_at:iso(x.creado)});
  for (const [index,x] of d.inventario.entries()) await insert(tx,"inventory_balances",{id:index+1,product_id:x.producto_id,location:x.ubicacion,quantity:x.cantidad,updated_at:new Date().toISOString()});
  for (const x of d.movimientos) await insert(tx,"inventory_movements",{id:x.id,product_id:x.producto_id,change:/venta|salida/i.test(x.tipo)?-Math.abs(x.cantidad):x.cantidad,reason:[x.tipo,x.origen&&`De ${x.origen}`,x.destino&&`a ${x.destino}`,x.notas].filter(Boolean).join(" · "),actor_id:"desktop-import",created_at:iso(x.fecha)});
  for (const x of d.clientes) await insert(tx,"clients",{id:x.id,code:x.codigo,first_name:x.nombre,last_name:x.apellido||"",phone:x.telefono||"",active:active(x.activo),created_at:iso(x.creado)});
  for (const x of d.facturas) { const seller=sellers.get(x.vendedor_id); await insert(tx,"invoices",{id:x.id,number:x.numero,client_id:x.cliente_id,seller_id:x.vendedor_id,partner_id:seller?.categoria==="Socio"?x.vendedor_id:(seller?.socio_id||null),subtotal:x.subtotal,discount:x.descuento,total:x.total,paid:x.pagado,balance:x.saldo,status:x.estado,notes:x.notas||"",created_at:iso(x.fecha),updated_at:iso(x.fecha)}); }
  for (const x of d.factura_items) await insert(tx,"invoice_items",{id:x.id,invoice_id:x.factura_id,product_id:x.producto_id,quantity:x.cantidad,unit_price:x.precio_unitario,unit_cost:x.costo_unitario,discount_pct:x.descuento_pct||0,total:x.total});
  for (const x of d.pagos) await insert(tx,"payments",{id:x.id,invoice_id:x.factura_id,applied_usd:x.monto,original_amount:x.monto_original||x.monto,currency:x.moneda||"USD",exchange_rate:x.tasa_cambio||1,excess_usd:0,excess_action:"",method:x.metodo||"",created_at:iso(x.fecha)});
  for (const x of d.caja_movimientos) await insert(tx,"cash_movements",{id:x.id,type:x.tipo,category:x.categoria,amount:x.monto,partner_id:x.integrante_id||null,invoice_id:x.factura_id||null,notes:x.notas||x.socio||"",created_at:iso(x.fecha)});
  for (const x of d.proveedores) await insert(tx,"suppliers",{id:x.id,name:x.nombre,phone:x.contacto||"",notes:[x.categoria,x.notas].filter(Boolean).join(" · "),active:active(x.activo)});
  for (const x of d.compras_proveedor) await insert(tx,"purchases",{id:x.id,supplier_id:x.proveedor_id,number:x.numero,concept:x.concepto,type:x.tipo,total:x.total,paid:x.pagado,balance:x.saldo,partner_id:null,created_at:iso(x.fecha)});
  for (const x of d.protocolos) await insert(tx,"protocols",{id:x.id,product_id:x.producto_id,name:x.nombre,vial_mg:x.vial_mg,diluent_ml:x.diluent_ml,dose:x.dosis,unit:x.unidad,every_days:x.cada_dias,weeks:x.semanas,include_instructions:active(x.incluir_instrucciones),updated_at:iso(x.actualizado||x.creado)});
  for (const x of d.configuracion) if(!String(x.clave).startsWith("r2_")&&x.clave!=="bac_pin") await insert(tx,"app_settings",{key:x.clave,value:x.valor,updated_at:new Date().toISOString()});
  for (const x of d.ventas) await insert(tx,"legacy_sales",{id:x.id,product_id:x.producto_id,seller_id:x.vendedor_id,partner_id:x.socio_id||null,quantity:x.cantidad,unit_price:x.precio_unitario,total:x.total,commission_pct:x.comision_pct,commission_amount:x.comision_monto,unit_cost:x.costo_unitario,total_cost:x.costo_total,notes:x.notas||"",created_at:iso(x.fecha)});
  for (const x of d.salidas_internas) await insert(tx,"internal_withdrawals",{id:x.id,number:x.numero,type:x.tipo,team_id:x.integrante_id,product_id:x.producto_id,quantity:x.cantidad,unit_cost:x.costo_unitario,total_cost:x.costo_total,paid:x.pagado,balance:x.saldo,status:x.estado,notes:x.notas||"",created_at:iso(x.fecha)});
  for (const x of d.pagos_proveedor) await insert(tx,"supplier_payments",{id:x.id,purchase_id:x.compra_id,amount:x.monto,method:x.metodo||"",created_at:iso(x.fecha)});
  for (const x of d.pagos_salidas_internas) await insert(tx,"internal_withdrawal_payments",{id:x.id,withdrawal_id:x.salida_id,amount:x.monto,method:x.metodo||"",source:x.origen||"",created_at:iso(x.fecha)});
  for (const table of ["calculations","products","team","clients","invoices","invoice_items","payments","cash_movements","suppliers","purchases","protocols","inventory_movements"]) await tx.unsafe(`select setval(pg_get_serial_sequence('${table}','id'), coalesce((select max(id) from ${table}),1), true)`);
});

const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
await supabase.storage.createBucket("product-images",{public:true}).catch(()=>{});
for(const product of d.productos.filter((x)=>x.foto&&fs.existsSync(x.foto))){
  const key=path.basename(product.foto),buffer=fs.readFileSync(product.foto),extension=path.extname(key).slice(1).toLowerCase();
  const {error}=await supabase.storage.from("product-images").upload(key,buffer,{upsert:true,contentType:`image/${extension==="jpg"?"jpeg":extension}`});
  if(error) console.warn(`Imagen ${key}: ${error.message}`);
}
console.log(JSON.stringify({products:d.productos.length,clients:d.clientes.length,invoices:d.facturas.length,inventory:d.inventario.length,images:d.productos.filter((x)=>x.foto&&fs.existsSync(x.foto)).length},null,2));
await sql.end();
