import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";

async function authorized() {
  return getChatGPTUser();
}

async function database() {
  const [{ getDb }, schema] = await Promise.all([
    import("@/db"),
    import("@/db/schema"),
  ]);
  return { db: getDb(), ...schema };
}

export async function GET() {
  if (!(await authorized()))
    return Response.json({ error: "No autorizado" }, { status: 401 });
  const { db, products } = await database();
  return Response.json({
    products: await db.select().from(products).orderBy(desc(products.updatedAt)),
  });
}

export async function POST(request: Request) {
  const user = await authorized();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const sku = String(body.sku ?? "").trim().toUpperCase();
  if (!name || !sku)
    return Response.json({ error: "Nombre y SKU son obligatorios" }, { status: 400 });
  const stock = Math.max(0, Number(body.stock) || 0);
  const { db, products, inventoryMovements } = await database();
  const [product] = await db
    .insert(products)
    .values({
      name,
      sku,
      category: String(body.category || "Péptido"),
      concentration: String(body.concentration || ""),
      stock,
      reorderPoint: Math.max(0, Number(body.reorderPoint) || 5),
      price: Math.max(0, Number(body.price) || 0),
    })
    .returning();
  if (stock)
    await db.insert(inventoryMovements).values({
      productId: product.id,
      change: stock,
      reason: "Inventario inicial",
      actorId: user.userId,
    });
  return Response.json({ product }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await authorized();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = (await request.json()) as { id?: number; change?: number; reason?: string };
  const id = Number(body.id);
  const change = Number(body.change);
  if (!id || !Number.isInteger(change) || change === 0)
    return Response.json({ error: "Movimiento inválido" }, { status: 400 });
  const { db, products, inventoryMovements } = await database();
  const [current] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!current)
    return Response.json({ error: "Producto no encontrado" }, { status: 404 });
  const nextStock = Math.max(0, current.stock + change);
  const applied = nextStock - current.stock;
  const [product] = await db
    .update(products)
    .set({ stock: nextStock, updatedAt: new Date().toISOString() })
    .where(eq(products.id, id))
    .returning();
  await db.insert(inventoryMovements).values({
    productId: id,
    change: applied,
    reason: String(body.reason || (change > 0 ? "Entrada" : "Salida")),
    actorId: user.userId,
  });
  return Response.json({ product });
}
