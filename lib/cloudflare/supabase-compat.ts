import { d1 } from "./d1";

type Row = Record<string, unknown>;
// La forma dinámica replica PostgREST; `any` mantiene compatibilidad con las rutas
// existentes mientras D1 valida nombres y parámetros antes de ejecutar SQL.
type Result = { data: any; error: { message: string } | null; count?: number | null };
const ident = (value: string) => { if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error("Identificador SQL inválido"); return `"${value}"`; };

class Query implements PromiseLike<Result> {
  private operation: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private columns = "*";
  private values: Row | Row[] | null = null;
  private filters: { field: string; op: "=" | "!=" | "in"; value: unknown }[] = [];
  private ordering: { field: string; ascending: boolean } | null = null;
  private maxRows: number | null = null;
  private singleMode: "single" | "maybe" | null = null;
  private head = false;
  private countMode = false;
  private conflict = "id";
  private returning = false;
  constructor(private readonly table: string) { ident(table); }
  select(columns = "*", options?: { count?: string; head?: boolean }) { this.columns = columns; this.returning = this.operation !== "select"; this.head = Boolean(options?.head); this.countMode = options?.count === "exact"; return this; }
  insert(values: Row | Row[]) { this.operation = "insert"; this.values = values; return this; }
  update(values: Row) { this.operation = "update"; this.values = values; return this; }
  delete() { this.operation = "delete"; return this; }
  upsert(values: Row | Row[], options?: { onConflict?: string }) { this.operation = "upsert"; this.values = values; this.conflict = options?.onConflict || "id"; return this; }
  eq(field: string, value: unknown) { ident(field); this.filters.push({ field, op: "=", value }); return this; }
  neq(field: string, value: unknown) { ident(field); this.filters.push({ field, op: "!=", value }); return this; }
  in(field: string, value: unknown[]) { ident(field); this.filters.push({ field, op: "in", value }); return this; }
  order(field: string, options?: { ascending?: boolean }) { ident(field); this.ordering = { field, ascending: options?.ascending !== false }; return this; }
  limit(value: number) { this.maxRows = Math.max(0, Math.trunc(value)); return this; }
  single() { this.singleMode = "single"; this.returning = this.operation !== "select"; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }
  then<TResult1 = Result, TResult2 = never>(resolve?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null, reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) { return this.execute().then(resolve, reject); }
  private where(params: unknown[]) { if (!this.filters.length) return ""; return " WHERE " + this.filters.map(filter => { if (filter.op === "in") { const values = filter.value as unknown[]; if (!values.length) return "0=1"; params.push(...values); return `${ident(filter.field)} IN (${values.map(() => "?").join(",")})`; } params.push(filter.value); return `${ident(filter.field)} ${filter.op} ?`; }).join(" AND "); }
  private columnList() { if (this.columns === "*") return "*"; return this.columns.split(",").map(x => ident(x.trim())).join(","); }
  private async execute(): Promise<Result> {
    try {
      const params: unknown[] = []; let sql = "";
      if (this.operation === "select") {
        const selected = this.countMode ? "COUNT(*) AS total" : this.columnList();
        sql = `SELECT ${selected} FROM ${ident(this.table)}${this.where(params)}`;
        if (this.ordering) sql += ` ORDER BY ${ident(this.ordering.field)} ${this.ordering.ascending ? "ASC" : "DESC"}`;
        if (this.maxRows != null) sql += ` LIMIT ${this.maxRows}`;
        const rows = (await d1.prepare(sql).bind(...params).all<Row>()).results;
        if (this.countMode) return { data: this.head ? null : rows, error: null, count: Number(rows[0]?.total || 0) };
        if (this.singleMode === "single" && rows.length !== 1) return { data: null, error: { message: rows.length ? "Se esperaba un solo registro" : "Registro no encontrado" } };
        if (this.singleMode) return { data: rows[0] || null, error: null };
        return { data: rows, error: null };
      }
      if (this.operation === "delete") {
        sql = `DELETE FROM ${ident(this.table)}${this.where(params)}`; await d1.prepare(sql).bind(...params).run(); return { data: null, error: null };
      }
      const rows = (Array.isArray(this.values) ? this.values : [this.values || {}]) as Row[];
      const returned: Row[] = [];
      for (const row of rows) {
        const fields = Object.keys(row); if (!fields.length) continue; fields.forEach(ident);
        const values = fields.map(key => row[key]);
        if (this.operation === "update") {
          const updateParams = [...values]; sql = `UPDATE ${ident(this.table)} SET ${fields.map(key => `${ident(key)}=?`).join(",")}${this.where(updateParams)}${this.returning ? ` RETURNING ${this.columnList()}` : ""}`;
          if (this.returning) returned.push(...(await d1.prepare(sql).bind(...updateParams).all<Row>()).results); else await d1.prepare(sql).bind(...updateParams).run();
        } else {
          sql = `INSERT INTO ${ident(this.table)} (${fields.map(ident).join(",")}) VALUES (${fields.map(() => "?").join(",")})`;
          if (this.operation === "upsert") { const keys = this.conflict.split(",").map(x => x.trim()); keys.forEach(ident); const updates = fields.filter(x => !keys.includes(x)).map(x => `${ident(x)}=excluded.${ident(x)}`).join(","); sql += ` ON CONFLICT (${keys.map(ident).join(",")}) DO ${updates ? `UPDATE SET ${updates}` : "NOTHING"}`; }
          sql += ` RETURNING ${this.returning ? this.columnList() : "*"}`;
          returned.push(...(await d1.prepare(sql).bind(...values).all<Row>()).results);
        }
      }
      if (this.singleMode === "single" && returned.length !== 1) return { data: null, error: { message: "No se pudo obtener el registro guardado" } };
      return { data: this.singleMode ? returned[0] || null : returned, error: null };
    } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : "Error de base de datos" } }; }
  }
}

export const cloudDb = { from: (table: string) => new Query(table) };
