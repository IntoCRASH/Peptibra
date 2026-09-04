import { getAuthorizedUser } from "@/app/chatgpt-auth";
import { pgDb } from "@/db/postgres-compat";
import { cloudDb } from "@/lib/cloudflare/supabase-compat";

type Data = Record<string, unknown>;
const json = (data: unknown, status = 200) => Response.json(data, { status });
const num = (v: unknown, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const str = (v: unknown) => String(v ?? "").trim();

export async function GET() {
  const user = await getAuthorizedUser(); if (!user) return json({ error: "No autorizado" }, 403);
  const supabase=cloudDb;
  const table=async(name:string)=>{const {data,error}=await supabase.from(name).select("*");if(error)throw error;return data as Data[]};
  try {
  const [productRows,profiles,balances,inventoryMovements,teamRows,clientRows,invoiceRows,invoiceItems,payments,cashRows,supplierRows,purchaseRows,calculations,protocols,internalWithdrawals,withdrawalPayments,settings,legacySales] = await Promise.all([
    table("products"),table("product_profiles"),table("inventory_balances"),table("inventory_movements"),table("team"),table("clients"),table("invoices"),table("invoice_items"),table("payments"),table("cash_movements"),table("suppliers"),table("purchases"),table("calculations"),table("protocols"),table("internal_withdrawals"),table("internal_withdrawal_payments"),table("app_settings"),table("legacy_sales"),
  ]);
  const byId=(rows:Data[])=>new Map(rows.map(x=>[Number(x.id),x])),teamMap=byId(teamRows),clientMap=byId(clientRows),supplierMap=byId(supplierRows),profileMap=new Map(profiles.map(x=>[Number(x.product_id),x]));
  let products=productRows.filter(x=>x.status==="active").map(x=>({...x,...profileMap.get(Number(x.id))}));
  const team=teamRows.filter(x=>Number(x.active)===1).map(x=>({...x,partner_name:teamMap.get(Number(x.partner_id))?.name??null}));
  let clients=clientRows.filter(x=>Number(x.active)===1);
  let invoices=invoiceRows.map(x=>{const c=clientMap.get(Number(x.client_id)),t=teamMap.get(Number(x.seller_id));return {...x,client_code:c?.code,client_name:`${c?.first_name??""} ${c?.last_name??""}`.trim(),client_phone:c?.phone,seller_name:t?.name}})
    .sort((a,b)=>{const byDate=Date.parse(String(b.created_at||""))-Date.parse(String(a.created_at||""));return Number.isFinite(byDate)&&byDate!==0?byDate:Number(b.id||0)-Number(a.id||0)});
  const cash=cashRows.map(x=>({...x,partner_name:teamMap.get(Number(x.partner_id))?.name??null}));
  const suppliers=supplierRows.filter(x=>Number(x.active)===1);
  const purchases=purchaseRows.map(x=>({...x,supplier_name:supplierMap.get(Number(x.supplier_id))?.name,partner_name:teamMap.get(Number(x.partner_id))?.name??null}));
  const withdrawals=internalWithdrawals.map(x=>({...x,team_member_id:x.team_id}));
  let visibleTeam=team,visibleBalances=balances,visibleMovements=inventoryMovements,visibleItems=invoiceItems,visiblePayments=payments,visibleCash=cash,visibleSuppliers=suppliers,visiblePurchases=purchases,visibleCalculations=calculations,visibleProtocols=protocols,visibleWithdrawals=withdrawals,visibleWithdrawalPayments=withdrawalPayments,visibleSettings=settings;
  if(user.role!=="admin"){
    // Cada cuenta ve únicamente su operación personal. La relación vendedor-socio
    // sirve para propiedad financiera, no para mezclar paneles ni inventarios.
    const allowedSellerIds=user.teamId?[user.teamId]:[];
    invoices=invoices.filter(x=>allowedSellerIds.includes(Number(x.seller_id)));
    const invoiceIds=new Set(invoices.map(x=>Number(x.id))),clientIds=new Set(invoices.map(x=>Number(x.client_id)));
    visibleItems=invoiceItems.filter(x=>invoiceIds.has(Number(x.invoice_id)));
    visiblePayments=payments.filter(x=>invoiceIds.has(Number(x.invoice_id)));
    clients=clients.filter(x=>clientIds.has(Number(x.id))||Number(x.owner_team_id)===user.teamId);
    visibleTeam=team.filter(x=>allowedSellerIds.includes(Number(x.id)));
    const allowedLocations=allowedSellerIds.map(id=>`VENDEDOR:${id}`);
    visibleBalances=balances.filter(x=>allowedLocations.includes(String(x.location)));
    visibleMovements=[];
    visibleCash=cash.filter(x=>Number(x.partner_id)===user.teamId&&["Cobro en manos de vendedor","Pago a Peptibra pendiente","Pago de vendedor a Peptibra"].includes(str(x.category)));
    // Los protocolos son material compartido: el equipo puede consultarlos,
    // mientras que las mutaciones siguen reservadas para administración.
    visibleSuppliers=[]; visiblePurchases=[]; visibleCalculations=[]; visibleWithdrawals=[]; visibleWithdrawalPayments=[]; visibleSettings=[];
    products=products.map(({unit_cost: _unitCost,calculation_id: _calculationId,wholesale_mg_price: _wholesalePrice,...product})=>product);
  }
  const member=user.teamId?teamMap.get(user.teamId):null,commissionRate=Number(member?.commission||0),commissionTotal=user.role==="vendedor"?invoices.reduce((sum,x)=>sum+num(x.paid)*commissionRate/100,0):0;
  const sellerHeld=user.role==="vendedor"?cash.filter(x=>Number(x.partner_id)===user.teamId&&str(x.category)==="Cobro en manos de vendedor").reduce((sum,x)=>sum+num(x.amount),0):0;
  const sellerRemitted=user.role==="vendedor"?cash.filter(x=>Number(x.partner_id)===user.teamId&&["Pago a Peptibra pendiente","Pago de vendedor a Peptibra"].includes(str(x.category))).reduce((sum,x)=>sum+num(x.amount),0):0;
  const remittanceDue=Math.max(0,sellerHeld*(1-commissionRate/100)-sellerRemitted);
  let financialSnapshot:Data|null=null;
  if(user.role==="admin"){
    const cashTotal=cash.reduce((sum,x)=>sum+(x.type==="Ingreso"?num(x.amount):x.type==="Egreso"?-num(x.amount):0),0);
    const soldCost=legacySales.reduce((sum,x)=>sum+num(x.total_cost),0)+internalWithdrawals.reduce((sum,x)=>sum+num(x.total_cost),0);
    const replenished=cash.filter(x=>["Compra inventario","Inventario pagado por socio"].includes(str(x.category))).reduce((sum,x)=>sum+num(x.amount),0)+purchases.filter(x=>x.type==="Inventario / insumos").reduce((sum,x)=>sum+num(x.total),0);
    const reserve=Math.max(0,soldCost-replenished);
    const commissions=Math.max(0,legacySales.reduce((sum,x)=>sum+num(x.commission_amount),0)-cash.filter(x=>x.category==="Pago comisión").reduce((sum,x)=>sum+num(x.amount),0));
    const supplierDue=Math.max(0,purchases.reduce((sum,x)=>sum+num(x.balance),0));
    const invoiceNumbers=new Set(invoiceRows.map(x=>`Factura ${x.number}`));
    let realizedGross=0;
    for(const invoice of invoiceRows){const ratio=num(invoice.total)>0?Math.min(1,num(invoice.paid)/num(invoice.total)):0,cost=invoiceItems.filter(x=>num(x.invoice_id)===num(invoice.id)).reduce((sum,x)=>sum+num(x.unit_cost)*num(x.quantity),0),commission=legacySales.filter(x=>str(x.notes)===`Factura ${invoice.number}`).reduce((sum,x)=>sum+num(x.commission_amount),0);realizedGross+=(num(invoice.total)-cost-commission)*ratio}
    realizedGross+=legacySales.filter(x=>!invoiceNumbers.has(str(x.notes))).reduce((sum,x)=>sum+num(x.total)-num(x.total_cost)-num(x.commission_amount),0);
    const expenses=cash.filter(x=>x.category==="Gasto operativo").reduce((sum,x)=>sum+num(x.amount),0)+purchases.filter(x=>x.type==="Gasto operativo").reduce((sum,x)=>sum+num(x.total),0)+internalWithdrawals.filter(x=>x.type==="Representación / promoción").reduce((sum,x)=>sum+num(x.total_cost),0);
    const realizedNet=Math.max(0,realizedGross-expenses),retention=Math.min(100,Math.max(0,num(settings.find(x=>x.key==="retencion_utilidad")?.value,20))),retained=realizedNet*retention/100,distributed=cash.filter(x=>x.category==="Distribución utilidad").reduce((sum,x)=>sum+num(x.amount),0),liquidAvailable=Math.max(0,cashTotal-reserve-commissions-supplierDue),distributable=Math.max(0,Math.min(realizedNet*(1-retention/100)-distributed,liquidAvailable));
    financialSnapshot={cash:cashTotal,reserve,commissions,supplierDue,realizedGross,realizedNet,retention,retained,distributed,liquidAvailable,distributable,promotionCost:internalWithdrawals.filter(x=>x.type==="Representación / promoción").reduce((sum,x)=>sum+num(x.total_cost),0)};
  }
  return json({ user:{name:user.displayName,email:user.email,role:user.role,teamId:user.teamId,partnerId:user.partnerId,commissionRate,commissionTotal,sellerHeld,remittanceDue},financialSnapshot,products,balances:visibleBalances,inventoryMovements:visibleMovements,team:visibleTeam,clients,invoices,invoiceItems:visibleItems,payments:visiblePayments,cash:visibleCash,suppliers:visibleSuppliers,purchases:visiblePurchases,calculations:visibleCalculations,protocols:visibleProtocols,internalWithdrawals:visibleWithdrawals,withdrawalPayments:visibleWithdrawalPayments,settings:visibleSettings });
  } catch(error) { return json({error:error instanceof Error?error.message:"No se pudieron cargar los datos"},500); }
}

export async function POST(request: Request) {
  const user = await getAuthorizedUser(); if (!user) return json({ error: "No autorizado" }, 403);
  const body=await request.json() as {action?:string;data?:Data},action=str(body.action),d=body.data??{},now=new Date().toISOString(),db=pgDb;
  const cloud=cloudDb;
  const fail=(error:unknown)=>json({error:typeof error==="object"&&error&&"message" in error?String(error.message):"No se pudo completar la acción"},500);
  const one=async(table:string,id:number)=>{const {data,error}=await cloud.from(table).select("*").eq("id",id).maybeSingle();if(error)throw error;return data as Data|null};
  const adminOnly=new Set(["createProduct","updateProduct","saveProductFamily","adjustStock","transferInventory","archive","cashMovement","deleteCashMovement","saveTeam","saveSupplier","savePurchase","deletePurchase","saveCalculation","saveProtocol","deleteProtocol","saveSetting","saveWithdrawal","payWithdrawal","deleteWithdrawal","reversePayments","reversePayment","deleteInvoice","confirmPeptibraPayment"]);
  if(user.role!=="admin"&&adminOnly.has(action))return json({error:"Esta operación está reservada para administración."},403);
  const canUseSeller=async(sellerId:number)=>user.role==="admin"||Boolean(user.teamId&&sellerId===user.teamId);
  const canUseInvoice=async(invoiceId:number)=>{if(user.role==="admin")return true;const invoice=await one("invoices",invoiceId);return Boolean(invoice&&user.teamId&&Number(invoice.seller_id)===user.teamId)};
  const canUseClient=async(clientId:number)=>{if(user.role==="admin")return true;const client=await one("clients",clientId);if(!client||!user.teamId)return false;if(Number(client.owner_team_id)===user.teamId)return true;const {data:linked}=await cloud.from("invoices").select("id").eq("client_id",clientId).eq("seller_id",user.teamId).limit(1).maybeSingle();return Boolean(linked)};
  try {
    if(action==="touchRevision"){const {error}=await cloud.from("app_settings").upsert({key:"mobile_data_revision",value:now,updated_at:now},{onConflict:"key"});if(error)throw error;return json({ok:true});}
    if(action==="notifyPeptibraPayment"){
      if(user.role!=="vendedor"||!user.teamId)return json({error:"Esta opción corresponde a cuentas de vendedores."},403);
      const amount=num(d.amount),rate=Math.max(0,Math.min(100,num((await one("team",user.teamId))?.commission)));
      const [{data:held},{data:sent}]=await Promise.all([
        cloud.from("cash_movements").select("amount").eq("partner_id",user.teamId).eq("category","Cobro en manos de vendedor"),
        cloud.from("cash_movements").select("amount").eq("partner_id",user.teamId).in("category",["Pago a Peptibra pendiente","Pago de vendedor a Peptibra"]),
      ]);
      const due=Math.max(0,(held||[]).reduce((s: number,x: Data)=>s+num(x.amount),0)*(1-rate/100)-(sent||[]).reduce((s: number,x: Data)=>s+num(x.amount),0));
      if(amount<=0)return json({error:"Indica un monto mayor que cero."},400);
      if(amount>due+.005)return json({error:`El máximo pendiente para pagar es ${due.toFixed(2)} USD.`},400);
      const notes=[str(d.method),str(d.reference),str(d.notes)].filter(Boolean).join(" · ");
      const {error}=await cloud.from("cash_movements").insert({type:"No monetario",category:"Pago a Peptibra pendiente",amount,partner_id:user.teamId,invoice_id:null,notes,created_at:now});
      if(error)throw error;return json({ok:true,amount});
    }
    if(action==="confirmPeptibraPayment"){
      const id=num(d.id),movement=await one("cash_movements",id);
      if(!movement||str(movement.category)!=="Pago a Peptibra pendiente")return json({error:"La notificación ya fue procesada o no existe."},404);
      const notes=[str(movement.notes),"Confirmado por administración"].filter(Boolean).join(" · ");
      const {error}=await cloud.from("cash_movements").update({type:"Ingreso",category:"Pago de vendedor a Peptibra",notes}).eq("id",id);
      if(error)throw error;return json({ok:true});
    }
    if(action==="createProduct"||action==="updateProduct"){
      const id=num(d.id),name=str(d.name),sku=str(d.sku).toUpperCase();if(!name||!sku)return json({error:"Nombre y código son obligatorios"},400);
      const product={name,sku,category:str(d.category)||"Péptido",concentration:str(d.concentration),reorder_point:num(d.reorderPoint,5),price:num(d.normalPrice),status:"active",updated_at:now};
      let productId=id;if(id){const {error}=await cloud.from("products").update(product).eq("id",id);if(error)throw error}else{const {data,error}=await cloud.from("products").insert({...product,stock:Math.trunc(num(d.stock)),created_at:now}).select("id").single();if(error)throw error;productId=Number(data.id)}
      const profile={product_id:productId,description:str(d.description),photo_key:str(d.photoKey),calculation_id:num(d.calculationId)||null,unit_cost:num(d.unitCost),normal_price:num(d.normalPrice),bac_price:0,wholesale_mg_price:num(d.wholesaleMgPrice),wholesale_minimum:num(d.wholesaleMinimum,10)};
      const {error:profileError}=await cloud.from("product_profiles").upsert(profile,{onConflict:"product_id"});if(profileError)throw profileError;
      if(!id){const qty=Math.trunc(num(d.stock));const {error}=await cloud.from("inventory_balances").insert({product_id:productId,location:"GENERAL",quantity:qty,updated_at:now});if(error)throw error;await cloud.from("inventory_movements").insert({product_id:productId,change:qty,reason:"Inventario inicial",actor_id:user.userId,created_at:now})}
      return json({ok:true,id:productId},id?200:201);
    }
    if(action==="saveProductFamily"){
      const concentrations=[5,10,15,20,30,40,50,100],name=str(d.name),oldName=str(d.oldName)||name;
      if(!name)return json({error:"El nombre es obligatorio"},400);
      const prices=new Map(concentrations.map(mg=>[mg,Math.max(0,num(d[`price${mg}`]))]));
      const costs=new Map(concentrations.map(mg=>[mg,Math.max(0,num(d[`cost${mg}`]))]));
      const otherPresentation=str(d.otherPresentation),otherPrice=Math.max(0,num(d.otherPrice)),otherCost=Math.max(0,num(d.otherCost));
      if(otherPrice>0&&!otherPresentation)return json({error:"Escribe la otra presentación o volumen"},400);
      if(![...prices.values()].some(price=>price>0)&&!(otherPresentation&&otherPrice>0))return json({error:"Indica al menos un precio por presentación"},400);
      const {data:allProducts,error:productsError}=await cloud.from("products").select("*");if(productsError)throw productsError;
      const family=(allProducts||[]).filter(x=>str(x.name).toLocaleLowerCase()===oldName.toLocaleLowerCase()),familyIds=family.map(x=>num(x.id));
      const {data:profiles,error:profilesError}=familyIds.length?await cloud.from("product_profiles").select("*").in("product_id",familyIds):{data:[],error:null};if(profilesError)throw profilesError;
      const profileById=new Map((profiles||[]).map(x=>[num(x.product_id),x])),mgOf=(value:unknown)=>{const match=str(value).match(/(?:^|\D)(5|10|15|20|30|40|50|100)\s*mg\b/i);return match?num(match[1]):0},byMg=new Map(family.map(x=>[mgOf(x.concentration),x]));
      const selectedId=num(d.id),selectedProfile=profileById.get(selectedId),baseSku=(str(d.sku)||name.replace(/[^a-z0-9]+/gi,"-")).toUpperCase().replace(/-(?:5|10|15|20|30|40|50|100)MG$/i,"");
      let firstId=selectedId||0;
      for(const mg of concentrations){const price=prices.get(mg)||0,cost=costs.get(mg)||0,existing=byMg.get(mg);if(existing){const productId=num(existing.id),profile=profileById.get(productId);const {error}=await cloud.from("products").update({name,concentration:`${mg}mg`,price,status:"active",updated_at:now}).eq("id",productId);if(error)throw error;const {error:profileError}=await cloud.from("product_profiles").upsert({product_id:productId,description:str(d.description),photo_key:str(profile?.photo_key||selectedProfile?.photo_key),calculation_id:null,unit_cost:cost,normal_price:price,bac_price:0,wholesale_mg_price:num(d.wholesaleMgPrice),wholesale_minimum:num(d.wholesaleMinimum,10)},{onConflict:"product_id"});if(profileError)throw profileError;firstId=firstId||productId}else if(price>0){const sku=`${baseSku}-${mg}MG`,{data:created,error}=await cloud.from("products").insert({name,sku,category:str(d.category)||"Péptido",concentration:`${mg}mg`,reorder_point:num(d.reorderPoint,5),price,status:"active",stock:0,created_at:now,updated_at:now}).select("id").single();if(error)throw error;const productId=num(created.id);const {error:profileError}=await cloud.from("product_profiles").insert({product_id:productId,description:str(d.description),photo_key:str(selectedProfile?.photo_key),calculation_id:null,unit_cost:cost,normal_price:price,bac_price:0,wholesale_mg_price:num(d.wholesaleMgPrice),wholesale_minimum:num(d.wholesaleMinimum,10)});if(profileError)throw profileError;const {error:stockError}=await cloud.from("inventory_balances").insert({product_id:productId,location:"GENERAL",quantity:0,updated_at:now});if(stockError)throw stockError;firstId=firstId||productId}}
      if(otherPresentation&&otherPrice>0){const selected=family.find(x=>num(x.id)===selectedId&&!mgOf(x.concentration));if(selected){const productId=num(selected.id),profile=profileById.get(productId),{error}=await cloud.from("products").update({name,concentration:otherPresentation,price:otherPrice,status:"active",updated_at:now}).eq("id",productId);if(error)throw error;const {error:profileError}=await cloud.from("product_profiles").upsert({product_id:productId,description:str(d.description),photo_key:str(profile?.photo_key||selectedProfile?.photo_key),calculation_id:null,unit_cost:otherCost,normal_price:otherPrice,bac_price:0,wholesale_mg_price:num(d.wholesaleMgPrice),wholesale_minimum:num(d.wholesaleMinimum,10)},{onConflict:"product_id"});if(profileError)throw profileError;firstId=firstId||productId}else{const sku=`${baseSku}-${otherPresentation.replace(/[^a-z0-9]+/gi,"-").toUpperCase()}`,{data:created,error}=await cloud.from("products").insert({name,sku,category:str(d.category)||"Producto",concentration:otherPresentation,reorder_point:num(d.reorderPoint,5),price:otherPrice,status:"active",stock:0,created_at:now,updated_at:now}).select("id").single();if(error)throw error;const productId=num(created.id);const {error:profileError}=await cloud.from("product_profiles").insert({product_id:productId,description:str(d.description),photo_key:str(selectedProfile?.photo_key),calculation_id:null,unit_cost:otherCost,normal_price:otherPrice,bac_price:0,wholesale_mg_price:num(d.wholesaleMgPrice),wholesale_minimum:num(d.wholesaleMinimum,10)});if(profileError)throw profileError;const {error:stockError}=await cloud.from("inventory_balances").insert({product_id:productId,location:"GENERAL",quantity:0,updated_at:now});if(stockError)throw stockError;firstId=firstId||productId}}
      return json({ok:true,id:firstId});
    }
    if(action==="adjustStock"){
      const productId=num(d.productId),location=str(d.location)||"GENERAL",change=Math.trunc(num(d.change)),{data:balance,error}=await cloud.from("inventory_balances").select("id,quantity").eq("product_id",productId).eq("location",location).maybeSingle();if(error)throw error;const quantity=Number(balance?.quantity||0)+change;
      const mutation=balance?cloud.from("inventory_balances").update({quantity,updated_at:now}).eq("id",balance.id):cloud.from("inventory_balances").insert({product_id:productId,location,quantity,updated_at:now});const {error:balanceError}=await mutation;if(balanceError)throw balanceError;await cloud.from("inventory_movements").insert({product_id:productId,change,reason:str(d.reason)||"Ajuste móvil",actor_id:user.userId,created_at:now});return json({ok:true,quantity});
    }
    if(action==="transferInventory"){
      const productId=num(d.productId),quantity=Math.max(1,Math.trunc(num(d.quantity))),from=str(d.from),to=str(d.to);if(!from||!to||from===to)return json({error:"Selecciona ubicaciones diferentes"},400);await changeBalance(productId,from,-quantity);await changeBalance(productId,to,quantity);const {error}=await cloud.from("inventory_movements").insert([{product_id:productId,change:-quantity,reason:`Transferencia móvil: ${from} → ${to}`,actor_id:user.userId,created_at:now},{product_id:productId,change:quantity,reason:`Transferencia móvil: ${from} → ${to}`,actor_id:user.userId,created_at:now}]);if(error)throw error;return json({ok:true});
    }
    if(action==="saveClient"){
      const id=num(d.id),values={first_name:str(d.firstName),last_name:str(d.lastName),phone:str(d.phone),active:1,...(user.role!=="admin"?{owner_team_id:user.teamId}:{})};if(id){if(user.role!=="admin"){const client=await one("clients",id);if(Number(client?.owner_team_id)!==user.teamId)return json({error:"No puedes modificar este cliente."},403)}const {error}=await cloud.from("clients").update(values).eq("id",id);if(error)throw error;return json({ok:true,id})}const {count}=await cloud.from("clients").select("id",{count:"exact",head:true}),code=str(d.code)||`PTBR${String((count||0)+1).padStart(6,"0")}`;const {data,error}=await cloud.from("clients").insert({...values,code,created_at:now}).select("id").single();if(error)throw error;return json({ok:true,id:data.id,code},201);
    }
    if(action==="createInvoice"||action==="updateInvoice"){
      const items=Array.isArray(d.items)?d.items as Data[]:[];if(!items.length)return json({error:"Agrega productos"},400);const sellerId=num(d.sellerId),clientId=num(d.clientId);if(!await canUseSeller(sellerId))return json({error:"No puedes registrar ventas para este integrante."},403);if(!await canUseClient(clientId))return json({error:"Ese cliente no pertenece a tu cuenta."},403);if(num(d.id)&&!await canUseInvoice(num(d.id)))return json({error:"No puedes modificar esta factura."},403);const seller=await one("team",sellerId),partnerId=seller?.role==="Socio"?sellerId:num(seller?.partner_id)||null,location=`VENDEDOR:${sellerId}`;
      const {data:catalog,error:catalogError}=await cloud.from("products").select("*").eq("status","active");if(catalogError)throw catalogError;const productById=new Map((catalog||[]).map(x=>[num(x.id),x])),bacProduct=(catalog||[]).find(x=>/bac water|bacteriost/i.test(str(x.name))),bacId=num(bacProduct?.id),{data:bacProfile}=bacId?await cloud.from("product_profiles").select("unit_cost").eq("product_id",bacId).maybeSingle():{data:null},bacCost=num(bacProfile?.unit_cost),requiresBac=(product:Data|undefined)=>Boolean(product&&/(?:^|\D)(?:5|10|15|20|30|40|50|100)\s*mg\b/i.test(str(product.concentration))&&!/bac water|bacteriost/i.test(str(product.name)));
      let invoiceId=num(d.id),number=str(d.number);if(invoiceId){const {data:oldItems,error}=await cloud.from("invoice_items").select("*").eq("invoice_id",invoiceId);if(error)throw error;let oldBac=0;for(const item of oldItems||[]){await changeBalance(Number(item.product_id),location,Number(item.quantity));if(requiresBac(productById.get(num(item.product_id))))oldBac+=num(item.quantity)}if(bacId&&oldBac)await changeBalance(bacId,location,oldBac);await cloud.from("invoice_items").delete().eq("invoice_id",invoiceId)}else{const {count}=await cloud.from("invoices").select("id",{count:"exact",head:true});number=`PTBR-F${now.slice(0,7).replace("-","")}-${String((count||0)+1).padStart(5,"0")}`}
      const progressive=Boolean(d.progressiveEnabled),minQty=Math.max(2,Math.trunc(num(d.minQty,2))),maxQty=Math.max(minQty+1,Math.trunc(num(d.maxQty,10))),minPct=Math.max(0,num(d.minPct,5)),maxPct=Math.min(100,Math.max(minPct,num(d.maxPct,15))),prepared:Data[]=[];
      for(const raw of items){const productId=num(raw.productId),qty=Math.max(1,Math.trunc(num(raw.quantity,1))),product=productById.get(productId)||await one("products",productId),{data:profile}=await cloud.from("product_profiles").select("*").eq("product_id",productId).maybeSingle();let unitPrice=num(raw.unitPrice),wholesale=false;const match=str(product?.concentration).match(/(\d+(?:[.,]\d+)?)\s*mg/i),rate=num(profile?.wholesale_mg_price),minimum=Math.trunc(num(profile?.wholesale_minimum));if(rate>0&&minimum>0&&qty>=minimum&&match){unitPrice=rate*Number(match[1].replace(",","."));wholesale=true}let progressiveRate=0;if(progressive&&!wholesale&&qty>=minQty)progressiveRate=qty>=maxQty?maxPct:minPct+(qty-minQty)/(maxQty-minQty)*(maxPct-minPct);prepared.push({...raw,productId,quantity:qty,unitPrice,unitCost:num(profile?.unit_cost||raw.unitCost)+(requiresBac(product)?bacCost:0),includesBac:requiresBac(product),progressiveRate,wholesale})}
      if(prepared.some(item=>item.includesBac)&&!bacId)return json({error:"No existe un producto activo de Agua BAC"},400);
      const subtotal=prepared.reduce((s,x)=>s+num(x.quantity)*num(x.unitPrice),0),progressiveNet=prepared.reduce((s,x)=>s+num(x.quantity)*num(x.unitPrice)*(1-num(x.progressiveRate)/100),0),manualType=str(d.manualDiscountType)||"Porcentaje",manualValue=Math.max(0,num(d.manualDiscountValue)),manualAmount=manualType==="Monto"?manualValue:progressiveNet*manualValue/100,maxManual=progressiveNet*num(seller?.max_discount)/100;if(manualAmount>maxManual+.001)return json({error:`El descuento manual supera el máximo autorizado de ${num(seller?.max_discount).toFixed(2)}%`},400);if(manualAmount>progressiveNet+.001)return json({error:"El descuento supera el importe de la factura"},400);const manualRate=progressiveNet?manualAmount/progressiveNet*100:0,total=Math.max(0,prepared.reduce((s,x)=>s+num(x.quantity)*num(x.unitPrice)*(1-num(x.progressiveRate)/100)*(1-manualRate/100),0)),discount=subtotal-total,values={number,client_id:num(d.clientId),seller_id:sellerId,partner_id:partnerId,subtotal,discount,total,balance:total,paid:0,status:"Pendiente",notes:str(d.notes),updated_at:now};
      if(invoiceId){const current=await one("invoices",invoiceId),paid=num(current?.paid);Object.assign(values,{paid,balance:Math.max(0,total-paid),status:paid>=total?"Pagada":paid>0?"Parcial":"Pendiente"});const {error}=await cloud.from("invoices").update(values).eq("id",invoiceId);if(error)throw error}else{const {data,error}=await cloud.from("invoices").insert({...values,created_at:now}).select("id").single();if(error)throw error;invoiceId=Number(data.id)}
      let bacRequired=0;for(const item of prepared){const qty=num(item.quantity),effectiveRate=(1-(1-num(item.progressiveRate)/100)*(1-manualRate/100))*100,line=qty*num(item.unitPrice)*(1-effectiveRate/100);const {error}=await cloud.from("invoice_items").insert({invoice_id:invoiceId,product_id:num(item.productId),quantity:qty,unit_price:num(item.unitPrice),unit_cost:num(item.unitCost),discount_pct:effectiveRate,total:line});if(error)throw error;await changeBalance(num(item.productId),location,-qty);if(item.includesBac)bacRequired+=qty}if(bacId&&bacRequired)await changeBalance(bacId,location,-bacRequired);return json({ok:true,id:invoiceId,number});
    }
    async function changeBalance(productId:number,location:string,change:number){const {data}=await cloud.from("inventory_balances").select("id,quantity").eq("product_id",productId).eq("location",location).maybeSingle(),quantity=Number(data?.quantity||0)+change;if(data)await cloud.from("inventory_balances").update({quantity,updated_at:now}).eq("id",data.id);else await cloud.from("inventory_balances").insert({product_id:productId,location,quantity,updated_at:now})}
    if(action==="applyPayment"){
      const id=num(d.invoiceId);if(!await canUseInvoice(id))return json({error:"No puedes aplicar pagos a esta factura."},403);const inv=await one("invoices",id);if(!inv)return json({error:"Factura no encontrada"},404);const rate=Math.max(.0001,num(d.exchangeRate,1)),original=num(d.originalAmount),usd=str(d.currency)==="DOP"?original/rate:original,due=num(inv.balance),applied=Math.min(usd,due),excess=Math.max(0,usd-due),choice=str(d.excessAction);if(excess>.005&&!choice)return json({error:"Selecciona devolver o dejar el excedente en caja",excess},409);const paid=num(inv.paid)+applied,balance=Math.max(0,num(inv.total)-paid),status=balance<=.005?"Pagada":"Parcial";let {error}=await cloud.from("invoices").update({paid,balance,status,updated_at:now}).eq("id",id);if(error)throw error;({error}=await cloud.from("payments").insert({invoice_id:id,applied_usd:applied,original_amount:original,currency:str(d.currency)||"USD",exchange_rate:rate,excess_usd:choice==="Caja"?excess:0,excess_action:choice,method:str(d.method)||"Efectivo",created_at:now}));if(error)throw error;
      if(user.role==="vendedor"){
        const held=applied+(choice==="Caja"?excess:0);
        if(held>.005)await cloud.from("cash_movements").insert({type:"No monetario",category:"Cobro en manos de vendedor",amount:held,partner_id:user.teamId,invoice_id:id,notes:`${str(inv.number)} · ${str(d.method)||"Efectivo"}`,created_at:now});
      }else{
        await cloud.from("cash_movements").insert({type:"Ingreso",category:"Cobro factura",amount:applied,invoice_id:id,notes:str(inv.number),created_at:now});if(choice==="Caja"&&excess>.005)await cloud.from("cash_movements").insert({type:"Ingreso",category:"Excedente de cliente",amount:excess,invoice_id:id,notes:str(inv.number),created_at:now});
      }
      return json({ok:true,applied,excess,status});
    }
    if(action==="reversePayments"){
      const id=num(d.invoiceId),inv=await one("invoices",id);if(!inv)return json({error:"Factura no encontrada"},404);await cloud.from("cash_movements").delete().eq("invoice_id",id);await cloud.from("payments").delete().eq("invoice_id",id);const {error}=await cloud.from("invoices").update({paid:0,balance:num(inv.total),status:"Pendiente",updated_at:now}).eq("id",id);if(error)throw error;return json({ok:true});
    }
    if(action==="reversePayment"){
      const payment=await one("payments",num(d.paymentId));if(!payment)return json({error:"Pago no encontrado"},404);const invoice=await one("invoices",num(payment.invoice_id));if(!invoice)return json({error:"Factura no encontrada"},404);const applied=num(payment.applied_usd),paid=Math.max(0,num(invoice.paid)-applied),balance=Math.max(0,num(invoice.total)-paid),status=paid<=.005?"Pendiente":balance<=.005?"Pagada":"Parcial";const {data:movement}=await cloud.from("cash_movements").select("id").eq("invoice_id",payment.invoice_id).eq("category","Cobro factura").eq("amount",applied).order("id",{ascending:false}).limit(1).maybeSingle();if(movement)await cloud.from("cash_movements").delete().eq("id",movement.id);if(num(payment.excess_usd)>0){const {data:extra}=await cloud.from("cash_movements").select("id").eq("invoice_id",payment.invoice_id).eq("category","Excedente de cliente").eq("amount",payment.excess_usd).order("id",{ascending:false}).limit(1).maybeSingle();if(extra)await cloud.from("cash_movements").delete().eq("id",extra.id)}await cloud.from("payments").delete().eq("id",payment.id);const {error}=await cloud.from("invoices").update({paid,balance,status,updated_at:now}).eq("id",payment.invoice_id);if(error)throw error;return json({ok:true});
    }
    if(action==="deleteInvoice"){
      const id=num(d.invoiceId),inv=await one("invoices",id);if(!inv)return json({error:"Factura no encontrada"},404);const location=`VENDEDOR:${num(inv.seller_id)}`,{data:items}=await cloud.from("invoice_items").select("*").eq("invoice_id",id),{data:catalog}=await cloud.from("products").select("id,name,concentration,status").eq("status","active"),productById=new Map((catalog||[]).map(x=>[num(x.id),x])),bac=(catalog||[]).find(x=>/bac water|bacteriost/i.test(str(x.name))),bacId=num(bac?.id);let bacRestore=0;for(const item of items||[]){await changeBalance(Number(item.product_id),location,Number(item.quantity));const product=productById.get(num(item.product_id));if(product&&/(?:^|\D)(?:5|10|15|20|30|40|50|100)\s*mg\b/i.test(str(product.concentration))&&!/bac water|bacteriost/i.test(str(product.name)))bacRestore+=num(item.quantity)}if(bacId&&bacRestore)await changeBalance(bacId,location,bacRestore);await cloud.from("cash_movements").delete().eq("invoice_id",id);await cloud.from("payments").delete().eq("invoice_id",id);await cloud.from("invoice_items").delete().eq("invoice_id",id);const {error}=await cloud.from("invoices").delete().eq("id",id);if(error)throw error;return json({ok:true});
    }
    if(action==="archive"){
      const entity=str(d.entity),id=num(d.id),map:Record<string,[string,string,string|number]>={product:["products","status","archived"],team:["team","active",0],client:["clients","active",0],supplier:["suppliers","active",0]};if(!map[entity])return json({error:"Registro no eliminable"},400);const [table,field,value]=map[entity],{error}=await cloud.from(table).update({[field]:value}).eq("id",id);if(error)throw error;return json({ok:true});
    }
    if(action==="cashMovement"){
      const choice=str(d.movement),amount=num(d.amount),partnerId=num(d.partnerId)||null;
      const definitions:Record<string,{type:string;category:string;partner:"none"|"socio"|"team"}>={
        "Dinero puesto por socio":{type:"Ingreso",category:"Aporte socio",partner:"socio"},
        "Compra pagada por socio":{type:"No monetario",category:"Inventario pagado por socio",partner:"socio"},
        "Gasto del negocio":{type:"Egreso",category:"Gasto operativo",partner:"none"},
        "Compra pagada por la caja":{type:"Egreso",category:"Compra inventario",partner:"none"},
        "Pagar comisión":{type:"Egreso",category:"Pago comisión",partner:"team"},
        "Devolver dinero a socio":{type:"Egreso",category:"Devolución aporte",partner:"socio"},
        "Repartir ganancias":{type:"Egreso",category:"Distribución utilidad",partner:"socio"},
      },definition=definitions[choice];
      if(!definition)return json({error:"Selecciona un movimiento válido"},400);
      if(!(amount>0))return json({error:"El monto debe ser mayor que cero"},400);
      const member=partnerId?await one("team",partnerId):null;
      if(definition.partner!=="none"&&!member)return json({error:"Selecciona el integrante correspondiente"},400);
      if(definition.partner==="socio"&&member?.role!=="Socio")return json({error:"Este movimiento requiere seleccionar un socio"},400);
      if(choice==="Pagar comisión"){
        const {data:sales}=await cloud.from("legacy_sales").select("commission_amount").eq("seller_id",partnerId);
        const {data:paid}=await cloud.from("cash_movements").select("amount").eq("category","Pago comisión").eq("partner_id",partnerId);
        const pending=(sales||[]).reduce((s,x)=>s+num(x.commission_amount),0)-(paid||[]).reduce((s,x)=>s+num(x.amount),0);
        if(amount>pending+.005)return json({error:`La comisión pendiente es ${pending.toFixed(2)} USD`},400);
      }
      if(choice==="Devolver dinero a socio"){
        const {data:movements}=await cloud.from("cash_movements").select("category,amount").eq("partner_id",partnerId);
        const owed=(movements||[]).reduce((s,x)=>s+(["Aporte socio","Inventario pagado por socio","Pago proveedor por socio"].includes(str(x.category))?num(x.amount):["Devolución aporte","Compensación retiro/aporte"].includes(str(x.category))?-num(x.amount):0),0);
        if(amount>owed+.005)return json({error:`Actualmente se le deben ${Math.max(0,owed).toFixed(2)} USD a este socio`},400);
      }
      if(choice==="Repartir ganancias"){
        const [{data:allCash},{data:allInvoices},{data:allItems},{data:allSales},{data:allPurchases},{data:allWithdrawals},{data:retentionRow},{data:partnerModeRow}]=await Promise.all([
          cloud.from("cash_movements").select("type,category,amount,partner_id"),
          cloud.from("invoices").select("id,number,total,paid"),cloud.from("invoice_items").select("invoice_id,unit_cost,quantity"),
          cloud.from("legacy_sales").select("total,total_cost,commission_amount,partner_id,notes"),
          cloud.from("purchases").select("type,total,balance"),cloud.from("internal_withdrawals").select("type,total_cost"),
          cloud.from("app_settings").select("value").eq("key","retencion_utilidad").maybeSingle(),
          cloud.from("app_settings").select("value").eq("key","ganancia_por_socio").maybeSingle(),
        ]);
        const cashBalance=(allCash||[]).reduce((s,x)=>s+(x.type==="Ingreso"?num(x.amount):x.type==="Egreso"?-num(x.amount):0),0);
        const invoiceNumbers=new Set((allInvoices||[]).map(x=>`Factura ${x.number}`));
        let realized=0,soldCost=0;
        for(const invoice of allInvoices||[]){const ratio=num(invoice.total)>0?Math.min(1,num(invoice.paid)/num(invoice.total)):0,cost=(allItems||[]).filter(x=>num(x.invoice_id)===num(invoice.id)).reduce((s,x)=>s+num(x.unit_cost)*num(x.quantity),0),commission=(allSales||[]).filter(x=>str(x.notes)===`Factura ${invoice.number}`).reduce((s,x)=>s+num(x.commission_amount),0);soldCost+=cost;realized+=(num(invoice.total)-cost-commission)*ratio}
        for(const sale of allSales||[]){if(invoiceNumbers.has(str(sale.notes)))continue;soldCost+=num(sale.total_cost);realized+=num(sale.total)-num(sale.total_cost)-num(sale.commission_amount)}
        soldCost+=(allWithdrawals||[]).reduce((s,x)=>s+num(x.total_cost),0);
        const expenses=(allCash||[]).filter(x=>x.category==="Gasto operativo").reduce((s,x)=>s+num(x.amount),0)+(allPurchases||[]).filter(x=>x.type==="Gasto operativo").reduce((s,x)=>s+num(x.total),0)+(allWithdrawals||[]).filter(x=>x.type==="Representación / promoción").reduce((s,x)=>s+num(x.total_cost),0);
        const replenished=(allCash||[]).filter(x=>["Compra inventario","Inventario pagado por socio"].includes(str(x.category))).reduce((s,x)=>s+num(x.amount),0)+(allPurchases||[]).filter(x=>x.type==="Inventario / insumos").reduce((s,x)=>s+num(x.total),0);
        const supplierDue=(allPurchases||[]).reduce((s,x)=>s+num(x.balance),0),commissions=Math.max(0,(allSales||[]).reduce((s,x)=>s+num(x.commission_amount),0)-(allCash||[]).filter(x=>x.category==="Pago comisión").reduce((s,x)=>s+num(x.amount),0)),reserve=Math.max(0,soldCost-replenished),retention=Math.min(100,Math.max(0,num(retentionRow?.value,20))),distributed=(allCash||[]).filter(x=>x.category==="Distribución utilidad").reduce((s,x)=>s+num(x.amount),0),net=Math.max(0,realized-expenses),liquid=Math.max(0,cashBalance-reserve-commissions-supplierDue),overall=Math.max(0,Math.min(net*(1-retention/100)-distributed,liquid));
        let allowed=overall;
        if(str(partnerModeRow?.value)==="1"){
          const invoiceByNote=new Map((allInvoices||[]).map(x=>[`Factura ${x.number}`,x])),partnerGross=(allSales||[]).filter(x=>num(x.partner_id)===partnerId).reduce((s,x)=>{const invoice=invoiceByNote.get(str(x.notes)),ratio=invoice&&num(invoice.total)>0?Math.min(1,num(invoice.paid)/num(invoice.total)):1;return s+Math.max(0,num(x.total)-num(x.total_cost)-num(x.commission_amount))*ratio},0),partnerDistributed=(allCash||[]).filter(x=>x.category==="Distribución utilidad"&&num(x.partner_id)===partnerId).reduce((s,x)=>s+num(x.amount),0);allowed=Math.min(overall,Math.max(0,partnerGross*(1-retention/100)-partnerDistributed));
        }
        if(amount>allowed+.005)return json({error:`Ahora mismo hay ${allowed.toFixed(2)} USD disponibles para repartir`},400);
      }
      const {error}=await cloud.from("cash_movements").insert({type:definition.type,category:definition.category,amount,partner_id:definition.partner==="none"?null:partnerId,notes:str(d.notes),created_at:now});if(error)throw error;return json({ok:true});
    }
    if(action==="deleteCashMovement"){const movement=await one("cash_movements",num(d.id));if(!movement)return json({error:"Movimiento no encontrado"},404);if(movement.invoice_id||movement.withdrawal_id||movement.purchase_id)return json({error:"Este movimiento está vinculado y debe corregirse desde su registro de origen"},400);const {error}=await cloud.from("cash_movements").delete().eq("id",movement.id);if(error)throw error;return json({ok:true});}
    if(action==="saveTeam"){const id=num(d.id),role=str(d.role)||"Vendedor",values={name:str(d.name),phone:str(d.phone),role,partner_id:role==="Socio"?null:num(d.partnerId)||null,commission:num(d.commission),max_discount:num(d.maxDiscount),notes:str(d.notes),active:1};const query=id?cloud.from("team").update(values).eq("id",id):cloud.from("team").insert({...values,created_at:now});const {error}=await query;if(error)throw error;return json({ok:true,id:id||undefined});}
    if(action==="saveSupplier"){const id=num(d.id),values={name:str(d.name),phone:str(d.phone),notes:str(d.notes),active:1},query=id?cloud.from("suppliers").update(values).eq("id",id):cloud.from("suppliers").insert(values),{error}=await query;if(error)throw error;return json({ok:true});}
    if(action==="savePurchase"){const id=num(d.id),total=num(d.total),paid=num(d.paid),values={supplier_id:num(d.supplierId),number:str(d.number)||`COMP-${Date.now()}`,concept:str(d.concept),type:str(d.type)||"Inventario / insumos",total,paid,balance:Math.max(0,total-paid),partner_id:num(d.partnerId)||null},query=id?cloud.from("purchases").update(values).eq("id",id):cloud.from("purchases").insert({...values,created_at:now}),{error}=await query;if(error)throw error;return json({ok:true});}
    if(action==="deletePurchase"){const {error}=await cloud.from("purchases").delete().eq("id",num(d.id));if(error)throw error;return json({ok:true});}
    if(action==="saveCalculation"){const id=num(d.id),values={name:str(d.name),product_cost:num(d.productCost),shipping:num(d.shipping),label_cost:num(d.labelCost),packaging:num(d.packaging),bac_cost:num(d.bacCost),other_cost:num(d.otherCost),units:Math.max(1,num(d.units,1)),sale_price:num(d.salePrice),includes_bac:d.includesBac?1:0},query=id?cloud.from("calculations").update(values).eq("id",id):cloud.from("calculations").insert(values),{error}=await query;if(error)throw error;return json({ok:true});}
    if(action==="saveProtocol"){const id=num(d.id),values={product_id:num(d.productId),name:str(d.name),vial_mg:num(d.vialMg),diluent_ml:num(d.diluentMl),dose:num(d.dose),unit:str(d.unit)||"mg",every_days:num(d.everyDays,7),weeks:num(d.weeks,4),include_instructions:d.includeInstructions?1:0,updated_at:now},query=id?cloud.from("protocols").update(values).eq("id",id):cloud.from("protocols").insert(values),{error}=await query;if(error)throw error;return json({ok:true});}
    if(action==="deleteProtocol"){const {error}=await cloud.from("protocols").delete().eq("id",num(d.id));if(error)throw error;return json({ok:true});}
    if(action==="saveSetting"){const {error}=await cloud.from("app_settings").upsert({key:str(d.key),value:str(d.value),updated_at:now},{onConflict:"key"});if(error)throw error;return json({ok:true});}
    if(action==="saveWithdrawal"){
      const teamId=num(d.teamId||d.teamMemberId),productId=num(d.productId),quantity=Math.max(1,Math.trunc(num(d.quantity))),{data:profile}=await cloud.from("product_profiles").select("unit_cost").eq("product_id",productId).maybeSingle(),unitCost=num(profile?.unit_cost),total=unitCost*quantity,location=`VENDEDOR:${teamId}`,number=`SI-${Date.now()}`;const {data,error}=await cloud.from("internal_withdrawals").insert({number,type:str(d.type)||"Retiro de socio al costo",team_id:teamId,product_id:productId,quantity,unit_cost:unitCost,total_cost:total,paid:0,balance:total,status:"Pendiente",notes:str(d.notes),created_at:now}).select("id").single();if(error)throw error;await changeBalance(productId,location,-quantity);await cloud.from("inventory_movements").insert({product_id:productId,change:-quantity,reason:`${str(d.type)} ${number}`,actor_id:user.userId,created_at:now});return json({ok:true,id:data.id});
    }
    if(action==="payWithdrawal"){
      const id=num(d.id||d.withdrawalId),withdrawal=await one("internal_withdrawals",id);if(!withdrawal)return json({error:"Retiro no encontrado"},404);const amount=Math.min(Math.max(0,num(d.amount)),num(withdrawal.balance)),paid=num(withdrawal.paid)+amount,balance=Math.max(0,num(withdrawal.total_cost)-paid),status=balance<=.005?"Pagado":paid>0?"Parcial":"Pendiente",source=str(d.source)||"Pago recibido";await cloud.from("internal_withdrawal_payments").insert({withdrawal_id:id,amount,method:str(d.method)||"Efectivo",source,created_at:now});await cloud.from("internal_withdrawals").update({paid,balance,status}).eq("id",id);const category=source==="Descontar de aporte"?"Retiro descontado de aporte":"Pago de retiro interno",type=source==="Descontar de aporte"?"No monetario":"Ingreso";await cloud.from("cash_movements").insert({type,category,amount,partner_id:withdrawal.team_id,notes:str(withdrawal.number),created_at:now});return json({ok:true});
    }
    if(action==="deleteWithdrawal"){
      const id=num(d.id),withdrawal=await one("internal_withdrawals",id);if(!withdrawal)return json({error:"Retiro no encontrado"},404);if(num(withdrawal.paid)>.005)return json({error:"Revierte sus pagos antes de eliminarlo"},400);const location=`VENDEDOR:${num(withdrawal.team_id)}`;await changeBalance(num(withdrawal.product_id),location,num(withdrawal.quantity));await cloud.from("internal_withdrawals").delete().eq("id",id);return json({ok:true});
    }
    if(["createProduct","updateProduct","adjustStock","saveClient","createInvoice","updateInvoice","applyPayment","reversePayments","deleteInvoice","archive"].includes(action))return json({error:"Operación incompleta"},500);
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
      const owner=await db.prepare("SELECT role,partner_id FROM team WHERE id=?").bind(sellerId).first<{role:string;partner_id:number|null}>(),partnerId=owner?.role==="Socio"?sellerId:owner?.partner_id??null,location=`VENDEDOR:${sellerId}`;
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

