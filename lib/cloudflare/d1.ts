type QueryMode = "all" | "first" | "run" | "batch";
type QueryResponse<T> = { result?: T; error?: string };

async function request<T>(payload: Record<string, unknown>): Promise<T> {
  const base = process.env.PEPTIBRA_API_URL;
  const key = process.env.PEPTIBRA_API_SECRET;
  if (!base || !key) throw new Error("La conexión Cloudflare de Peptibra no está configurada");
  const response = await fetch(`${base}/query`, { method: "POST", headers: { "content-type": "application/json", "x-peptibra-key": key }, body: JSON.stringify(payload), cache: "no-store" });
  const data = await response.json() as QueryResponse<T>;
  if (!response.ok || data.error) throw new Error(data.error || `Cloudflare respondió ${response.status}`);
  return data.result as T;
}

class Statement {
  private args: unknown[] = [];
  constructor(private readonly sql: string) {}
  bind(...args: unknown[]) { this.args = args; return this; }
  async all<T = Record<string, unknown>>() { const value = await request<{ results: T[] }>({ sql: this.sql, params: this.args, mode: "all" }); return { results: value.results || [] }; }
  async first<T = Record<string, unknown>>() { return request<T | null>({ sql: this.sql, params: this.args, mode: "first" }); }
  async run() { const value = await request<{ meta?: { last_row_id?: number; changes?: number } }>({ sql: this.sql, params: this.args, mode: "run" }); return { meta: value.meta || {} }; }
  toJSON() { return { sql: this.sql, params: this.args }; }
}

export const d1 = {
  prepare: (sql: string) => new Statement(sql),
  batch: async (statements: Statement[]) => request({ mode: "batch" satisfies QueryMode, statements: statements.map(x => x.toJSON()) }),
};

export const allRows = async <T = Record<string, unknown>>(sql: string, ...args: unknown[]) => (await d1.prepare(sql).bind(...args).all<T>()).results;
