/**
 * The HTTP entrypoint's configuration: the same `MCP_*` keys, bounds and defaults as the server this one
 * replaces, so a deployment's environment carries over unchanged. A value out of bounds is refused at boot,
 * naming its key, never at the first request. The API's keys (`VIAFREI_API_URL`, `VIAFREI_API_KEY`,
 * `VIAFREI_API_TIMEOUT_MS`) are read by the API client.
 *
 * `MCP_HOST`, `MCP_PORT` and `MCP_LOG_LEVEL` fall back to `HOST`, `PORT` and `LOG_LEVEL`, the names this
 * package's first releases read.
 */
import { z } from "zod";

export const mcpEnvSchema = z.object({
  MCP_HOST: z.string().default("127.0.0.1"),
  MCP_PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  /** Comma-separated origins a browser client may call from; the CORS grant and the transports' 403 read it. */
  MCP_ALLOWED_ORIGINS: z.string().default("http://127.0.0.1:8787,http://localhost:8787"),
  MCP_LOG_LEVEL: z.string().default("info"),
  /** The public URL; its host joins the accepted Host headers. */
  MCP_PUBLIC_URL: z.string().url().optional(),
  /** A bind beyond loopback is opt-in: the process refuses to start without it. */
  MCP_ALLOW_PUBLIC: z.enum(["0", "1"]).default("0"),
  MCP_SESSION_TTL_S: z.coerce.number().int().min(60).max(86_400).default(1_800),
  MCP_SESSION_SWEEP_S: z.coerce.number().int().min(10).max(3_600).default(60),
  MCP_MAX_BODY_KB: z.coerce.number().int().min(8).max(1_024).default(64),
  /** The per-address limit: requests running at once (0: no cap), the refill per minute (0: none) and the burst. */
  MCP_IP_MAX_INFLIGHT: z.coerce.number().int().min(0).max(1_000).default(8),
  MCP_IP_RATE_PER_MIN: z.coerce.number().int().min(0).max(100_000).default(240),
  MCP_IP_RATE_BURST: z.coerce.number().int().min(1).max(100_000).default(60),
  /** Comma-separated addresses or CIDR blocks whose X-Forwarded-For is believed. */
  MCP_TRUSTED_PROXY_CIDR: z.string().default(""),
  /** Live sessions at once (0: no cap) and per address (0: no cap). */
  MCP_MAX_SESSIONS: z.coerce.number().int().min(0).max(100_000).default(500),
  MCP_MAX_SESSIONS_PER_ADDRESS: z.coerce.number().int().min(0).max(100_000).default(0),
});
export type McpEnv = z.infer<typeof mcpEnvSchema>;

/** The configuration from an environment: empty values are absent, and the three old names fill the new ones. */
export function mcpEnv(source: Record<string, string | undefined> = process.env): McpEnv {
  const set = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== "")) as Record<string, string>;
  for (const [key, old] of [["MCP_HOST", "HOST"], ["MCP_PORT", "PORT"], ["MCP_LOG_LEVEL", "LOG_LEVEL"]] as const) {
    const fallback = set[old];
    if (set[key] === undefined && fallback !== undefined) set[key] = fallback;
  }
  const parsed = mcpEnvSchema.safeParse(set);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${String(issue?.path.join(".") ?? "environment")}: ${issue?.message ?? "invalid"}`);
  }
  return parsed.data;
}

/** True for a bind address only this machine can reach. */
export function isLoopback(host: string): boolean {
  return ["127.0.0.1", "localhost", "::1"].includes(host);
}

/** The Host header values accepted (DNS-rebinding protection): the bind, loopback, and the public URL's host. */
export function allowedHostsOf(e: McpEnv): string[] {
  return [`${e.MCP_HOST}:${String(e.MCP_PORT)}`, `localhost:${String(e.MCP_PORT)}`, `127.0.0.1:${String(e.MCP_PORT)}`, ...(e.MCP_PUBLIC_URL ? [new URL(e.MCP_PUBLIC_URL).host] : [])];
}

/** The origins list, trimmed, empty entries dropped. */
export function allowedOriginsOf(e: McpEnv): string[] {
  return e.MCP_ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
}
