import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
const db=new DatabaseSync("C:/PepCalculo/peptibra.db"),all=sql=>db.prepare(sql).all().map(row=>({...row}));
const tables={
 calculations:all("SELECT id,nombre name,costo_producto product_cost,envio shipping,etiqueta label_cost,empaque packaging,costo_agua_bac bac_cost,otros other_cost,unidades units,precio_venta sale_price,incluye_bac includes_bac FROM calculos"),
 products:all("SELECT id,nombre name,printf('PTBR-%04d',id) sku,CASE WHEN nombre LIKE '%BAC%' THEN 'Agua bacteriostática' ELSE 'Péptido' END category,presentacion concentration,precio_normal price,CASE WHEN activo=1 THEN 'active' ELSE 'archived' END status,creado created_at,creado updated_at,0 stock,5 reorder_point FROM productos"),
 product_profiles:all("SELECT id product_id,descripcion description,'' photo_key,NULL calculation_id,costo_unitario unit_cost,precio_normal normal_price,0 bac_price,precio_mayor_mg wholesale_mg_price,minimo_mayor wholesale_minimum FROM productos"),
 inventory_balances:all("SELECT row_number() over(order by producto_id,ubicacion) id,producto_id product_id,ubicacion location,cantidad quantity,datetime('now') updated_at FROM inventario"),
 inventory_movements:all("SELECT id,producto_id product_id,cantidad change,coalesce(nullif(notas,''),tipo) reason,'windows' actor_id,fecha created_at FROM movimientos"),
 team:all("SELECT id,nombre name,telefono phone,categoria role,socio_id partner_id,comision commission,descuento_max max_discount,notas notes,activo active,creado created_at FROM vendedores"),
 clients:all("SELECT id,codigo code,nombre first_name,apellido last_name,telefono phone,activo active,creado created_at,NULL owner_team_id FROM clientes"),
 invoices:all("SELECT f.id,f.numero number,f.cliente_id client_id,f.vendedor_id seller_id,CASE WHEN v.categoria='Socio' THEN f.vendedor_id ELSE v.socio_id END partner_id,f.subtotal,f.descuento discount,f.total,f.pagado paid,f.saldo balance,f.estado status,f.notas notes,f.fecha created_at,f.fecha updated_at FROM facturas f LEFT JOIN vendedores v ON v.id=f.vendedor_id"),
 invoice_items:all("SELECT id,factura_id invoice_id,producto_id product_id,cantidad quantity,precio_unitario unit_price,costo_unitario unit_cost,descuento_pct discount_pct,total FROM factura_items"),
 payments:all("SELECT id,factura_id invoice_id,monto applied_usd,monto_original original_amount,moneda currency,tasa_cambio exchange_rate,0 excess_usd,'' excess_action,metodo method,fecha created_at FROM pagos"),
 cash_movements:all("SELECT id,tipo type,categoria category,monto amount,integrante_id partner_id,factura_id invoice_id,notas notes,fecha created_at FROM caja_movimientos"),
 suppliers:all("SELECT id,nombre name,contacto phone,notas notes,activo active FROM proveedores"),
 purchases:all("SELECT id,proveedor_id supplier_id,numero number,concepto concept,tipo type,total,pagado paid,saldo balance,NULL partner_id,fecha created_at FROM compras_proveedor"),
 protocols:all("SELECT id,producto_id product_id,nombre name,vial_mg,diluent_ml,dosis dose,unidad unit,cada_dias every_days,semanas weeks,incluir_instrucciones include_instructions,actualizado updated_at FROM protocolos"),
 internal_withdrawals:all("SELECT id,numero number,tipo type,integrante_id team_id,producto_id product_id,cantidad quantity,costo_unitario unit_cost,costo_total total_cost,pagado paid,saldo balance,estado status,notas notes,fecha created_at FROM salidas_internas"),
 internal_withdrawal_payments:all("SELECT id,salida_id withdrawal_id,monto amount,metodo method,origen source,fecha created_at FROM pagos_salidas_internas"),
 supplier_payments:all("SELECT id,compra_id purchase_id,monto amount,metodo method,fecha created_at FROM pagos_proveedor"),
 legacy_sales:all("SELECT id,producto_id product_id,vendedor_id seller_id,socio_id partner_id,cantidad quantity,precio_unitario unit_price,total,comision_pct commission_pct,comision_monto commission_amount,costo_unitario unit_cost,costo_total total_cost,notas notes,fecha created_at FROM ventas")
};
fs.writeFileSync("tmp/windows-cloud-sync.json",JSON.stringify({replace:true,tables}),"utf8");
console.log(Object.fromEntries(Object.entries(tables).map(([name,rows])=>[name,rows.length])));
