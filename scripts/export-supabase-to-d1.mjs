import fs from "node:fs";
import postgres from "postgres";

const tables = [
  "app_settings", "calculations", "cash_movements", "clients",
  "internal_withdrawal_payments", "internal_withdrawals", "inventory_balances",
  "inventory_movements", "invoice_items", "invoices", "legacy_sales", "payments",
  "product_profiles", "products", "protocols", "purchases", "supplier_payments",
  "suppliers", "sync_log", "team", "user_profiles",
];

const sql = postgres(process.env.POSTGRES_URL, { ssl: "require", max: 1, prepare: false });
const quote = value => value == null ? "NULL" : typeof value === "number" ? String(value) : typeof value === "boolean" ? (value ? "1" : "0") : `'${String(value).replaceAll("'", "''")}'`;
const typeMap = type => ["bigint", "integer", "boolean"].includes(type) ? "INTEGER" : type === "real" ? "REAL" : "TEXT";
const specialKeys = { app_settings: ["key"], inventory_balances: ["product_id", "location"], product_profiles: ["product_id"], user_profiles: ["email"] };
const chunks = ["PRAGMA foreign_keys=OFF;"];
const summary = {};

for (const table of tables) {
  const columns = await sql`
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema='public' and table_name=${table}
    order by ordinal_position`;
  if (!columns.length) continue;
  const keys = specialKeys[table] || (columns.some(c => c.column_name === "id") ? ["id"] : []);
  const definitions = columns.map(column => {
    const primary = keys.length === 1 && keys[0] === column.column_name ? " PRIMARY KEY" : "";
    return `"${column.column_name}" ${typeMap(column.data_type)}${primary}`;
  });
  if (keys.length > 1) definitions.push(`PRIMARY KEY (${keys.map(x => `"${x}"`).join(",")})`);
  chunks.push(`DROP TABLE IF EXISTS "${table}";`);
  chunks.push(`CREATE TABLE "${table}" (${definitions.join(",")});`);
  const rows = await sql.unsafe(`select * from "${table}" order by ${keys.length ? keys.map(x => `"${x}"`).join(",") : "1"}`);
  summary[table] = rows.length;
  for (const row of rows) {
    const names = Object.keys(row);
    chunks.push(`INSERT INTO "${table}" (${names.map(x => `"${x}"`).join(",")}) VALUES (${names.map(x => quote(row[x])).join(",")});`);
  }
}

chunks.push(`CREATE TABLE IF NOT EXISTS "auth_users" ("id" TEXT PRIMARY KEY,"email" TEXT NOT NULL UNIQUE,"password_hash" TEXT NOT NULL DEFAULT '',"role" TEXT NOT NULL,"team_id" INTEGER,"active" INTEGER NOT NULL DEFAULT 1,"must_change_password" INTEGER NOT NULL DEFAULT 1,"created_at" TEXT NOT NULL,"updated_at" TEXT NOT NULL);`);
chunks.push(`INSERT OR IGNORE INTO auth_users(id,email,role,team_id,active,created_at,updated_at) SELECT lower(email),lower(email),role,team_id,active,datetime('now'),datetime('now') FROM user_profiles;`);
chunks.push(`CREATE TABLE IF NOT EXISTS "auth_sessions" ("id_hash" TEXT PRIMARY KEY,"user_id" TEXT NOT NULL,"expires_at" TEXT NOT NULL,"created_at" TEXT NOT NULL);`);
chunks.push("PRAGMA foreign_keys=ON;");
fs.mkdirSync("cloudflare", { recursive: true });
fs.writeFileSync("cloudflare/migration.sql", chunks.join("\n"), "utf8");
fs.writeFileSync("cloudflare/migration-summary.json", JSON.stringify(summary, null, 2) + "\n", "utf8");
console.log(summary);
await sql.end();
