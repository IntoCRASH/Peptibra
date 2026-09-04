import { randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
const password = `Ptbr-${randomBytes(9).toString("base64url")}!`;
const salt = randomBytes(16).toString("base64url");
const hash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString("base64url")}`;
const now = new Date().toISOString();
const esc = value => String(value).replaceAll("'", "''");
fs.writeFileSync("cloudflare/bootstrap-admin.sql", `UPDATE auth_users SET password_hash='${esc(hash)}',must_change_password=1,updated_at='${now}' WHERE email='cruzmonty1983@gmail.com';\n`, "utf8");
console.log(password);
