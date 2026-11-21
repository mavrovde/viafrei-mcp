/**
 * The HTTP app: Streamable HTTP on /mcp (sessions in memory), the legacy HTTP+SSE pair (/sse, /messages)
 * for older clients, and /healthz, /readyz. Readiness is the API's own readiness: the server has no
 * database to ping.
 */
import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { log } from "./log.js";
import { createServer, type ServerDeps } from "./server.js";

export const SESSION_IDLE_MS = 30 * 60 * 1000;

export function createApp(deps: ServerDeps): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  const sessions = new Map<string, { transport: StreamableHTTPServerTransport; seen: number }>();
  const sse = new Map<string, SSEServerTransport>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [id, s] of sessions) if (now - s.seen > SESSION_IDLE_MS) void s.transport.close();
  }, 60_000);
  sweep.unref();

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/readyz", async (_req, res) => {
    try {
      const r = await fetch(`${deps.api.config.baseUrl}/readyz`, { signal: AbortSignal.timeout(5_000) });
      res.status(r.ok ? 200 : 503).json({ status: r.ok ? "ready" : "api-not-ready" });
    } catch {
      res.status(503).json({ status: "api-unreachable" });
    }
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    const id = req.header("mcp-session-id");
    const known = id === undefined ? undefined : sessions.get(id);
    if (known !== undefined) {
      known.seen = Date.now();
      await known.transport.handleRequest(req, res, req.body);
      return;
    }
    if (id !== undefined || !isInitializeRequest(req.body)) {
      res.status(id === undefined ? 400 : 404).json({ jsonrpc: "2.0", error: { code: -32000, message: id === undefined ? "No session: send initialize first" : "Session not found" }, id: null });
      return;
    }
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        sessions.set(sid, { transport, seen: Date.now() });
      },
    });
    transport.onclose = () => {
      if (transport.sessionId !== undefined) sessions.delete(transport.sessionId);
    };
    await createServer(deps).connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const bySession = async (req: Request, res: Response): Promise<void> => {
    const id = req.header("mcp-session-id");
    const s = id === undefined ? undefined : sessions.get(id);
    if (s === undefined) {
      res.status(404).end();
      return;
    }
    s.seen = Date.now();
    await s.transport.handleRequest(req, res);
  };
  app.get("/mcp", bySession);
  app.delete("/mcp", bySession);

  app.get("/sse", async (_req, res) => {
    const transport = new SSEServerTransport("/messages", res);
    sse.set(transport.sessionId, transport);
    res.on("close", () => sse.delete(transport.sessionId));
    await createServer(deps).connect(transport);
  });
  app.post("/messages", async (req, res) => {
    const t = sse.get(String(req.query["sessionId"] ?? ""));
    if (t === undefined) {
      res.status(404).end();
      return;
    }
    await t.handlePostMessage(req, res, req.body);
  });

  app.use((err: unknown, _req: Request, res: Response, _next: unknown) => {
    log.warn({ error: err instanceof Error ? err.name : "error" }, "request failed");
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
  });
  return app;
}
