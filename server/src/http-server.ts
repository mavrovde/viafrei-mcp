/**
 * The HTTP program as a function: read the configuration, build the dependencies, hand them to the route table
 * in `app.ts`, bind the port, and drain on a stop signal. `http.ts` only calls it, so a test can start the real
 * program on port 0 and stop it.
 */
import type { Server } from "node:http";
import { createMcpApp, type McpApp } from "./app.js";
import { parseTrustedProxies } from "./client-ip.js";
import { depsFromEnv } from "./deps.js";
import { allowedHostsOf, allowedOriginsOf, isLoopback, mcpEnv, type McpEnv } from "./env.js";
import { log } from "./log.js";
import { requestErrorLine } from "./request-log.js";
import { createReadiness, READINESS_DEADLINE_MS, type ReadyState } from "./readiness.js";
import { createUsageLedger, usageLogFields, type UsageLedger } from "./usage.js";

/**
 * The idle keep-alive outlasts the proxy in front: an edge that reuses a connection the server has just closed
 * gets a reset, which its client reads as a failed request. The edge's idle limit is 90 s, so the server holds
 * an idle connection for 120 s, and the header timeout is set above the keep-alive, as Node requires.
 */
export const KEEP_ALIVE_TIMEOUT_MS = 120_000;
export const HEADERS_TIMEOUT_MS = 125_000;

export function withIdleTimeouts<S extends { keepAliveTimeout: number; headersTimeout: number }>(server: S): S {
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;
  return server;
}

/** Readiness is the API's own: its `/readyz` under the deadline; `slow` past it, `degraded` on a refusal. */
export function apiReadiness(baseUrl: string, warn?: (fields: Record<string, unknown>, message: string) => void, deadlineMs = READINESS_DEADLINE_MS): () => Promise<ReadyState> {
  return createReadiness({
    ping: async () => {
      const r = await fetch(`${baseUrl}/readyz`, { signal: AbortSignal.timeout(deadlineMs) });
      if (!r.ok) throw new Error(`the API answered its readiness ${String(r.status)}`);
    },
    deadlineMs,
    ...(warn === undefined ? {} : { warn }),
  });
}

/** The longest a stop waits for the last usage counts before it exits anyway. */
export const STOP_DEADLINE_MS = 3_000;
/** 128 + the signal number: the codes Node's own default handlers exit with. */
export const EXIT_ON_SIGNAL = { SIGTERM: 143, SIGINT: 130 } as const;

export type HttpHooks = {
  readonly exit?: (code: number) => void;
  readonly onSignal?: (signal: "SIGTERM" | "SIGINT", fn: () => void) => void;
};

export type HttpProgram = { readonly env: McpEnv; readonly server: Server; readonly mcp: McpApp; readonly usage: UsageLedger; readonly stop: (signal: keyof typeof EXIT_ON_SIGNAL) => Promise<void> };

/** Starts the HTTP program, or throws naming the configuration it refuses. */
export function startHttp(source: Record<string, string | undefined> = process.env, hooks: HttpHooks = {}): HttpProgram {
  const e = mcpEnv(source);
  // No auth: a bind beyond loopback is opt-in, so nobody exposes /mcp by setting one variable they did not read.
  if (!isLoopback(e.MCP_HOST) && e.MCP_ALLOW_PUBLIC !== "1") {
    throw new Error(`MCP_HOST=${e.MCP_HOST} would expose /mcp without auth. Bind to 127.0.0.1 (put a proxy in front) or set MCP_ALLOW_PUBLIC=1 knowingly.`);
  }
  const exit = hooks.exit ?? ((code: number) => process.exit(code));
  const deps = depsFromEnv(source);
  const ready = apiReadiness(deps.api.config.baseUrl, (fields, message) => { log.warn(fields, message); });
  // The usage counters: one structured line per bucket, once a minute; the last bucket on a stop.
  const usage = createUsageLedger({
    write: async (rows) => { for (const r of rows) log.info(usageLogFields(r), "mcp usage"); },
    tools: new Set(deps.catalogue.tools.map((t) => t.name)),
    warn: (fields, message) => { log.warn(fields, message); },
  });
  usage.start();
  const toolNames: ReadonlySet<string> = new Set(deps.catalogue.tools.map((t) => t.name));
  const mcp = createMcpApp({
    deps,
    allowedOrigins: allowedOriginsOf(e),
    allowedHosts: allowedHostsOf(e),
    maxBodyKb: e.MCP_MAX_BODY_KB,
    sessionTtlMs: e.MCP_SESSION_TTL_S * 1_000,
    sessionSweepMs: e.MCP_SESSION_SWEEP_S * 1_000,
    // Liveness is process state; nothing here may await.
    health: () => ({ ok: true }),
    ready,
    // One line per MCP request; its fields are a closed list, no argument and no address. A request that
    // went wrong gets a second line, warn or error, naming the fault (request-log.ts).
    requestLog: (line) => {
      log.info(line, "mcp request");
      const fault = requestErrorLine(line, toolNames);
      if (fault !== null) log[fault.level](fault.fields, fault.message);
    },
    usage: usage.record,
    ipLimits: { maxInflight: e.MCP_IP_MAX_INFLIGHT, ratePerMin: e.MCP_IP_RATE_PER_MIN, burst: e.MCP_IP_RATE_BURST },
    trustedProxies: parseTrustedProxies(e.MCP_TRUSTED_PROXY_CIDR),
    maxSessions: e.MCP_MAX_SESSIONS,
    maxSessionsPerAddress: e.MCP_MAX_SESSIONS_PER_ADDRESS,
    sessionRetryAfterS: Math.min(60, e.MCP_SESSION_SWEEP_S),
    warn: (fields, message) => { log.warn(fields, message); },
  });
  const server = withIdleTimeouts(mcp.app.listen(e.MCP_PORT, e.MCP_HOST, () => log.info({ host: e.MCP_HOST, port: e.MCP_PORT }, "mcp server listening")));
  let stopping: Promise<void> | undefined;
  // A deploy stops the container with SIGTERM: stop listening, write the last counts, then exit with the
  // signal's code, bounded so a stuck write cannot hold the stop past the grace period.
  const stop = (signal: keyof typeof EXIT_ON_SIGNAL): Promise<void> => {
    stopping ??= (async () => {
      const code = EXIT_ON_SIGNAL[signal];
      const deadline = setTimeout(() => exit(code), STOP_DEADLINE_MS);
      deadline.unref();
      server.close();
      await mcp.close();
      await usage.stop().catch(() => false);
      clearTimeout(deadline);
      exit(code);
    })();
    return stopping;
  };
  const onSignal = hooks.onSignal ?? ((signal, fn) => { process.once(signal, fn); });
  onSignal("SIGTERM", () => { void stop("SIGTERM"); });
  onSignal("SIGINT", () => { void stop("SIGINT"); });
  return { env: e, server, mcp, usage, stop };
}
