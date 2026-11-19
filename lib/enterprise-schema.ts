import { pgDb } from "@/db/postgres-compat";

const VERSION = "enterprise_schema_v1";
let initialization: Promise<void> | null = null;

export function ensureEnterpriseSchema() {
  if (initialization) return initialization;
  initialization = (async () => {
    const current = await pgDb.prepare("SELECT value FROM app_settings WHERE key=?").bind(VERSION).first<{ value?: string }>();
    if (current?.value === "1") return;
    const now = new Date().toISOString();
    await pgDb.batch([
      pgDb.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id TEXT NOT NULL,
        actor_email TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        before_json TEXT,
        after_json TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      )`),
      pgDb.prepare("CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id, created_at)"),
      pgDb.prepare("CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id, created_at)"),
      pgDb.prepare(`CREATE TABLE IF NOT EXISTS inventory_lots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        lot_number TEXT NOT NULL,
        supplier_id INTEGER,
        location TEXT NOT NULL,
        received_quantity INTEGER NOT NULL DEFAULT 0,
        available_quantity INTEGER NOT NULL DEFAULT 0,
        unit_cost REAL NOT NULL DEFAULT 0,
        manufactured_at TEXT,
        expires_at TEXT,
        coa_url TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(product_id, location, lot_number)
      )`),
      pgDb.prepare("CREATE INDEX IF NOT EXISTS idx_inventory_lots_fifo ON inventory_lots(product_id, location, status, expires_at, created_at)"),
      pgDb.prepare(`CREATE TABLE IF NOT EXISTS inventory_lot_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lot_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        location TEXT NOT NULL,
        quantity_change INTEGER NOT NULL,
        reason TEXT NOT NULL,
        reference_type TEXT,
        reference_id TEXT,
        actor_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      pgDb.prepare("CREATE INDEX IF NOT EXISTS idx_lot_movements_lot ON inventory_lot_movements(lot_id, created_at)"),
      pgDb.prepare(`CREATE TABLE IF NOT EXISTS invoice_item_lots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_item_id INTEGER NOT NULL,
        lot_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        UNIQUE(invoice_item_id, lot_id)
      )`),
      pgDb.prepare(`CREATE TABLE IF NOT EXISTS loyalty_rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        milestone INTEGER NOT NULL,
        reward_type TEXT NOT NULL DEFAULT 'Producto gratis por 10 referidos',
        status TEXT NOT NULL DEFAULT 'earned',
        earned_at TEXT NOT NULL,
        redeemed_at TEXT,
        invoice_id INTEGER,
        product_id INTEGER,
        notes TEXT,
        created_by TEXT,
        UNIQUE(client_id, milestone)
      )`),
      pgDb.prepare("CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_client ON loyalty_rewards(client_id, status, earned_at)"),
      pgDb.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(VERSION, "1", now),
    ]);
  })().catch(error => { initialization = null; throw error; });
  return initialization;
}

