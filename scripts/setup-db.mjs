import fs from "node:fs";
import postgres from "postgres";
const source=["../drizzle/0000_peptibra_inventory.sql","../drizzle/0001_bored_hellfire_club.sql"].map(path=>fs.readFileSync(new URL(path,import.meta.url),"utf8")).join("\n--> statement-breakpoint\n");
const converted=source.replaceAll("`",'"').replace(/"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL/g,'"id" bigserial PRIMARY KEY').replace(/text DEFAULT CURRENT_TIMESTAMP NOT NULL/g,"timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL").replace(/integer DEFAULT false/g,"integer DEFAULT 0").replace(/integer DEFAULT true/g,"integer DEFAULT 1");
const sql=postgres(process.env.POSTGRES_URL,{ssl:"require",max:1});
for(const statement of converted.split("--> statement-breakpoint").map(x=>x.trim()).filter(Boolean)) await sql.unsafe(statement);
await sql.end();
console.log("Schema Peptibra listo.");

