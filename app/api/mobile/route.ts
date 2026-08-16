import { getAuthorizedUser } from "@/app/chatgpt-auth";
import { pgDb } from "@/db/postgres-compat";
import { createClient } from "@supabase/supabase-js";

type Data = Record<string, unknown>;
const json = (data: unknown, status = 200) => Response.json(data, { status });
const num = (v: unknown, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const str = (v: unknown) => String(v ?? "").trim();

export async function GET() {
  const user = await getAuthorizedUser(); if (!user) return json({ error: "No autorizado" }, 403);
  const supabase=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
  const table=async(name:string)=>{const {data,error}=await supabase.from(name).select("*");if(error)throw error;return data as Data[]};
  try {
  const [productRows,profiles,balances,teamRows,clientRows,invoiceRows,invoiceItems,cashRows,supplierRows,purchaseRows,calculations,protocols,settings] = await Promise.all([
    table("products"),table("product_profiles"),table("inventory_balances"),table("team"),table("clients"),table("invoices"),table("invoice_items"),table("cash_movements"),table("suppliers"),table("purchases"),table("calculations"),table("protocols"),table("app_settings"),
  ]);
  const byId=(rows:Data[])=>new Map(rows.map(x=>[Number(x.id),x])),teamMap=byId(teamRows),clientMap=byId(clientRows),supplierMap=byId(supplierRows),profileMap=new Map(profiles.map(x=>[Number(x.product_id),x]));
  const products=productRows.filter(x=>x.status==="active").map(x=>({...x,...profileMap.get(Number(x.id))}));
  const team=teamRows.filter(x=>Number(x.active)===1).map(x=>({...x,partner_name:teamMap.get(Number(x.partner_id))?.name??null}));
  const clients=clientRows.filter(x=>Number(x.active)===1);
  const invoices=invoiceRows.map(x=>{const c=clientMap.get(Number(x.client_id)),t=teamMap.get(Number(x.seller_id));return {...x,client_code:c?.code,client_name:`${c?.first_name??""} ${c?.last_name??""}`.trim(),seller_name:t?.name}});
  const cash=cashRows.map(x=>({...x,partner_name:teamMap.get(Number(x.partner_id))?.name??null}));
  const suppliers=supplierRows.filter(x=>Number(x.active)===1);
  const purchases=purchaseRows.map(x=>({...x,supplier_name:supplierMap.get(Number(x.supplier_id))?.name,partner_name:teamMap.get(Number(x.partner_id))?.name??null}));
  return json({ user:{name:user.displayName,email:user.email}, products,balances,team,clients,invoices,invoiceItems,cash,suppliers,purchases,calculations,protocols,settings });
  } catch(error) { return json({error:error instanceof Error?error.message:"No se pudieron cargar los datos"},500); }
}

export async function POST(request: Request) {
  const user = await getAuthorizedUser(); if (!user) return json({ error: "No autorizado" }, 403);
  const body=await request.json() as {action?:string;data?:Data},action=str(body.action),d=body.data??{},now=new Date().toISOString(),db=pgDb;
  try {
    if(action==="createProduct"){
      const name=str(d.name),sku=str(d.sku).toUpperCase();if(!name||!sku)return json({error:"Nombre y código son obligatorios"},400);
      const r=await db.prepare(`INSERT INTO products(name,sku,category,concentration,stock,reorder_point,price,status,created_at,updated_at) VALUES(?,?,?,?,0,?,?,?, ?,?)`)
        .bind(name,sku,str(d.category)||"Péptido",str(d.concentration),num(d.reorderPoint,5),num(d.normalPrice),"active",now,now).run(),id=Number(r.meta.last_row_id),stock=Math.trunc(num(d.stock));
      await db.batch([db.prepare(`INSERT INTO product_profiles(product_id,description,unit_cost,normal_price,bac_price,wholesale_mg_price,wholesale_minimum) VALUES(?,?,?,?,?,?,?)`)
        .bind(id,str(d.description),num(d.unitCost),num(d.normalPrice),num(d.bacPrice),num(d.wholesaleMgPrice),num(d.wholesaleMinimum,10)),
        db.prepare("INSERT INTO inventory_balances(product_id,location,quantity,updated_at) VALUES(?,?,?,?)").bind(id,"GENERAL",stock,now),
        db.prepare("INSERT INTO inventory_movements(product_id,change,reason,actor_id,created_at) VALUES(?,?,?,?,?)").bind(id,stock,"Inventario inicial",user.userId,now)]);
      return json({ok:true,id},201);
    }
    if(action==="adjustStock"){
      const id=num(d.productId),location=str(d.location)||"GENERAL",change=Math.trunc(num(d.change));
      const old=await db.prepare("SELECT quantity FROM inventory_balances WHERE product_id=? AND location=?").bind(id,location).first<{quantity:number}>(),next=(old?.quantity??0)+change;
      await db.batch([db.prepare(`INSERT INTO inventory_balances(product_id,location,quantity,updated_at) VALUES(?,?,?,?) ON CONFLICT(product_id,location) DO UPDATE SET quantity=excluded.quantity,updated_at=excluded.updated_at`).bind(id,location,next,now),
        db.prepare("INSERT INTO inventory_movements(product_id,change,reason,actor_id,created_at) VALUES(?,?,?,?,?)").bind(id,change,str(d.reason)||"Ajuste móvil",user.userId,now)]);return json({ok:true,quantity:next});
    }
    if(action==="saveTeam"){
      const role=str(d.role)||"Vendedor",partnerId=role==="Socio"?null:(num(d.partnerId)||null);if(role==="Vendedor"&&str(d.partnerMode)==="1"&&!partnerId)return json({error:"Selecciona el socio responsable"},400);
      const r=await db.prepare(`INSERT INTO team(name,phone,role,partner_id,commission,max_discount,notes,active,created_at) VALUES(?,?,?,?,?,?,?,1,?)`)
        .bind(str(d.name),str(d.phone),role,partnerId,num(d.commission),num(d.maxDiscount),str(d.notes),now).run();return json({ok:true,id:r.meta.last_row_id},201);
    }
    if(action==="saveClient"){
      const next=await db.prepare("SELECT COALESCE(MAX(id),0)+1 n FROM clients").first<{n:number}>(),code=str(d.code)||`PTBR${String(next?.n??1).padStart(6,"0")}`;
      const r=await db.prepare("INSERT INTO clients(code,first_name,last_name,phone,active,created_at) VALUES(?,?,?,?,1,?)").bind(code,str(d.firstName),str(d.lastName),str(d.phone),now).run();return json({ok:true,id:r.meta.last_row_id,code},201);
    }
    if(action==="createInvoice"){
      const items=Array.isArray(d.items)?d.items as Data[]:[];if(!items.length)return json({error:"Agrega productos"},400);
      const subtotal=items.reduce((s,x)=>s+num(x.quantity)*num(x.unitPrice),0),discount=num(d.discount),total=Math.max(0,subtotal-discount),sellerId=num(d.sellerId);
      const owner=await db.prepare("SELECT role,partner_id FROM team WHERE id=?").bind(sellerId).first<{role:string;partner_id:number|null}>(),partnerId=owner?.role==="Socio"?sellerId:owner?.partner_id??null,location=partnerId?`SOCIO:${partnerId}`:`VENDEDOR:${sellerId}`;
      const next=await db.prepare("SELECT COALESCE(MAX(id),0)+1 n FROM invoices").first<{n:number}>(),number=`PTBR-F${new Date().toISOString().slice(0,7).replace("-","")}-${String(next?.n??1).padStart(5,"0")}`;
      const r=await db.prepare(`INSERT INTO invoices(number,client_id,seller_id,partner_id,subtotal,discount,total,paid,balance,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,0,?,'Pendiente',?,?,?)`)
        .bind(number,num(d.clientId),sellerId,partnerId,subtotal,discount,total,total,str(d.notes),now,now).run(),invoiceId=Number(r.meta.last_row_id),batch=[];
      for(const item of items){const productId=num(item.productId),qty=Math.trunc(num(item.quantity,1)),line=Math.max(0,qty*num(item.unitPrice)-num(item.discount)),old=await db.prepare("SELECT quantity FROM inventory_balances WHERE product_id=? AND location=?").bind(productId,location).first<{quantity:number}>();
        batch.push(db.prepare("INSERT INTO invoice_items(invoice_id,product_id,quantity,unit_price,unit_cost,discount_pct,total) VALUES(?,?,?,?,?,?,?)").bind(invoiceId,productId,qty,num(item.unitPrice),num(item.unitCost),num(item.discountPct),line));
        batch.push(db.prepare(`INSERT INTO inventory_balances(product_id,location,quantity,updated_at) VALUES(?,?,?,?) ON CONFLICT(product_id,location) DO UPDATE SET quantity=excluded.quantity,updated_at=excluded.updated_at`).bind(productId,location,(old?.quantity??0)-qty,now));
        batch.push(db.prepare("INSERT INTO inventory_movements(product_id,change,reason,actor_id,created_at) VALUES(?,?,?,?,?)").bind(productId,-qty,`Factura ${number}`,user.userId,now));}
      await db.batch(batch);return json({ok:true,id:invoiceId,number},201);
    }
    if(action==="applyPayment"){
      const id=num(d.invoiceId),inv=await db.prepare("SELECT * FROM invoices WHERE id=?").bind(id).first<Record<string,number|string>>();if(!inv)return json({error:"Factura no encontrada"},404);
      const rate=Math.max(.0001,num(d.exchangeRate,1)),original=num(d.originalAmount),usd=str(d.currency)==="DOP"?original/rate:original,due=num(inv.balance),applied=Math.min(usd,due),excess=Math.max(0,usd-due),choice=str(d.excessAction);
      if(excess>.005&&!choice)return json({error:"Selecciona devolver o dejar el excedente en caja",excess},409);const paid=num(inv.paid)+applied,balance=Math.max(0,num(inv.total)-paid),status=balance<=.005?"Pagada":paid>0?"Parcial":"Pendiente";
      const batch=[db.prepare("UPDATE invoices SET paid=?,balance=?,status=?,updated_at=? WHERE id=?").bind(paid,balance,status,now,id),
        db.prepare(`INSERT INTO payments(invoice_id,applied_usd,original_amount,currency,exchange_rate,excess_usd,excess_action,method,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(id,applied,Math.min(original,due*rate),str(d.currency)||"USD",rate,choice==="Caja"?excess:0,choice,str(d.method)||"Efectivo",now),
        db.prepare("INSERT INTO cash_movements(type,category,amount,invoice_id,notes,created_at) VALUES('Ingreso','Cobro factura',?,?,?,?)").bind(applied,id,str(inv.number),now)];
      if(choice==="Caja"&&excess>.005)batch.push(db.prepare("INSERT INTO cash_movements(type,category,amount,invoice_id,notes,created_at) VALUES('Ingreso','Excedente de cliente',?,?,?,?)").bind(excess,id,str(inv.number),now));await db.batch(batch);return json({ok:true,applied,excess,status});
    }
    if(action==="cashMovement"){await db.prepare("INSERT INTO cash_movements(type,category,amount,partner_id,notes,created_at) VALUES(?,?,?,?,?,?)").bind(str(d.type),str(d.category),num(d.amount),num(d.partnerId)||null,str(d.notes),now).run();return json({ok:true});}
    if(action==="saveSupplier"){const r=await db.prepare("INSERT INTO suppliers(name,phone,notes,active) VALUES(?,?,?,1)").bind(str(d.name),str(d.phone),str(d.notes)).run();return json({ok:true,id:r.meta.last_row_id},201);}
    if(action==="savePurchase"){const total=num(d.total),paid=num(d.paid),r=await db.prepare(`INSERT INTO purchases(supplier_id,number,concept,type,total,paid,balance,partner_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(num(d.supplierId),str(d.number)||`COMP-${Date.now()}`,str(d.concept),str(d.type)||"Inventario / insumos",total,paid,Math.max(0,total-paid),num(d.partnerId)||null,now).run();return json({ok:true,id:r.meta.last_row_id},201);}
    if(action==="saveCalculation"){const r=await db.prepare(`INSERT INTO calculations(name,product_cost,shipping,label_cost,packaging,bac_cost,other_cost,units,sale_price,includes_bac) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(str(d.name),num(d.productCost),num(d.shipping),num(d.labelCost),num(d.packaging),num(d.bacCost),num(d.otherCost),Math.max(1,num(d.units,1)),num(d.salePrice),d.includesBac?1:0).run();return json({ok:true,id:r.meta.last_row_id},201);}
    if(action==="saveProtocol"){const r=await db.prepare(`INSERT INTO protocols(product_id,name,vial_mg,diluent_ml,dose,unit,every_days,weeks,include_instructions,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(num(d.productId),str(d.name),num(d.vialMg),num(d.diluentMl),num(d.dose),str(d.unit)||"mg",num(d.everyDays,7),num(d.weeks,4),d.includeInstructions?1:0,now).run();return json({ok:true,id:r.meta.last_row_id},201);}
    if(action==="saveSetting"){await db.prepare(`INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).bind(str(d.key),str(d.value),now).run();return json({ok:true});}
    if(action==="archive"){const map:Record<string,string>={product:"products",team:"team",client:"clients",supplier:"suppliers"},table=map[str(d.entity)];if(!table)return json({error:"Registro no eliminable"},400);const field=table==="products"?"status":"active";await db.prepare(`UPDATE ${table} SET ${field}=? WHERE id=?`).bind(table==="products"?"archived":0,num(d.id)).run();return json({ok:true});}
    return json({error:"Acción desconocida"},400);
  }catch(error){return json({error:error instanceof Error?error.message:"No se pudo completar la acción"},500);}
}

