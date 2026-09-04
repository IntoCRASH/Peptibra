interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  API_SECRET: string;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const authorized = (request: Request, env: Env) => {
  const supplied = request.headers.get("x-peptibra-key") || "";
  if (!supplied || supplied.length !== env.API_SECRET.length) return false;
  let mismatch = 0;
  for (let i = 0; i < supplied.length; i++) mismatch |= supplied.charCodeAt(i) ^ env.API_SECRET.charCodeAt(i);
  return mismatch === 0;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, service: "peptibra-api" });
    if (request.method === "GET" && url.pathname.startsWith("/files/")) {
      const object = await env.FILES.get(decodeURIComponent(url.pathname.slice(7)));
      if (!object) return new Response("No encontrado", { status: 404 });
      const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("etag", object.httpEtag); headers.set("cache-control", "public,max-age=86400");
      return new Response(object.body, { headers });
    }
    if (!authorized(request, env)) return json({ error: "No autorizado" }, 401);
    try {
      if (request.method === "POST" && url.pathname === "/query") {
        const body = await request.json<{ sql?: string; params?: unknown[]; mode?: "all" | "first" | "run" | "batch"; statements?: { sql: string; params?: unknown[] }[] }>();
        if (body.mode === "batch") {
          const statements = (body.statements || []).map(item => env.DB.prepare(item.sql).bind(...(item.params || [])));
          if (!statements.length || statements.length > 100) return json({ error: "Lote inválido" }, 400);
          const result = await env.DB.batch(statements);
          return json({ result });
        }
        if (!body.sql || body.sql.length > 20000) return json({ error: "Consulta inválida" }, 400);
        const statement = env.DB.prepare(body.sql).bind(...(body.params || []));
        if (body.mode === "run") return json({ result: await statement.run() });
        if (body.mode === "first") return json({ result: await statement.first() });
        return json({ result: await statement.all() });
      }
      if (request.method === "PUT" && url.pathname.startsWith("/files/")) {
        const key = decodeURIComponent(url.pathname.slice(7));
        if (!key || key.includes("..")) return json({ error: "Ruta inválida" }, 400);
        await env.FILES.put(key, request.body, { httpMetadata: { contentType: request.headers.get("content-type") || "application/octet-stream" } });
        return json({ ok: true, key });
      }
      if (request.method === "DELETE" && url.pathname.startsWith("/files/")) {
        await env.FILES.delete(decodeURIComponent(url.pathname.slice(7))); return json({ ok: true });
      }
      return json({ error: "Ruta no encontrada" }, 404);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Error interno" }, 500);
    }
  },
};
