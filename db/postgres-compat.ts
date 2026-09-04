// Compatibilidad temporal para la lógica existente: ahora apunta a Cloudflare D1.
export { d1 as pgDb, allRows } from "@/lib/cloudflare/d1";
