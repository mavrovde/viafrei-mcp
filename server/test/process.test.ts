/**
 * The process wiring: the HTTP program listens where MCP_HOST and MCP_PORT say (PORT and HOST as fallbacks,
 * port 8787 on loopback otherwise), refuses a public bind nobody opted into, holds idle connections past the
 * edge's limit, and on SIGTERM or SIGINT stops listening, writes the last usage bucket and exits with the
 * signal's code; the dependencies come from the environment; the logger's level and its redaction of
 * credentials and keys in a URL.
 */
import { createServer as createNetServer, type AddressInfo } from "node:net";
import { request } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXIT_ON_SIGNAL, HEADERS_TIMEOUT_MS, KEEP_ALIVE_TIMEOUT_MS, startHttp, STOP_DEADLINE_MS, type HttpProgram } from "../src/http-server.js";
import { allowedHostsOf, mcpEnv } from "../src/env.js";
import { log } from "../src/log.js";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** A port nobody listens on, for the program to bind. */
async function freePort(): Promise<number> {
  const s = createNetServer();
  await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", () => resolve()));
  const { port } = s.address() as AddressInfo;
  await new Promise<void>((resolve) => s.close(() => resolve()));
  return port;
}

type Started = { program: HttpProgram; exit: ReturnType<typeof vi.fn>; signals: Map<string, () => void>; port: number };
const running: Started[] = [];
afterEach(async () => {
  for (const s of running.splice(0)) {
    s.program.server.closeAllConnections();
    await new Promise<void>((resolve) => { s.program.server.close(() => resolve()); if (!s.program.server.listening) resolve(); });
    await s.program.mcp.close();
    await s.program.usage.stop();
  }
});

async function start(env: Record<string, string | undefined> = {}): Promise<Started> {
  const port = await freePort();
  const exit = vi.fn();
  const signals = new Map<string, () => void>();
  const program = startHttp({ MCP_PORT: String(port), VIAFREI_API_URL: "http://alpha.example", ...env }, { exit, onSignal: (signal, fn) => { signals.set(signal, fn); } });
  if (!program.server.listening) await new Promise<void>((resolve) => program.server.once("listening", () => resolve()));
  const s = { program, exit, signals, port };
  running.push(s);
  return s;
}

/** One GET over a fresh keep-alive connection: its status and headers. */
function get(port: number, path: string): Promise<{ status: number; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, headers: { connection: "keep-alive" } }, (res) => {
      res.resume();
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
    });
    req.on("error", reject);
    req.end();
  });
}

describe("the HTTP program (http-server.ts)", () => {
  it("binds MCP_HOST:MCP_PORT, 127.0.0.1 by default, and answers /healthz", async () => {
    const s = await start();
    expect(s.program.server.address()).toMatchObject({ address: "127.0.0.1", port: s.port });
    expect((await get(s.port, "/healthz")).status).toBe(200);
  });

  it("holds an idle connection past the edge's 90 s limit: Keep-Alive timeout=120 on every answer", async () => {
    const s = await start();
    expect([s.program.server.keepAliveTimeout, s.program.server.headersTimeout]).toEqual([KEEP_ALIVE_TIMEOUT_MS, HEADERS_TIMEOUT_MS]);
    const r = await get(s.port, "/healthz");
    expect(r.headers["keep-alive"]).toBe("timeout=120");
  });

  it("refuses a public bind without MCP_ALLOW_PUBLIC=1, naming the key; starts with it", async () => {
    expect(() => startHttp({ MCP_HOST: "0.0.0.0", MCP_PORT: "1" }, { exit: vi.fn(), onSignal: () => undefined })).toThrow(/^MCP_HOST=0\.0\.0\.0 would expose \/mcp without auth\..*MCP_ALLOW_PUBLIC=1/u);
    const s = await start({ MCP_HOST: "0.0.0.0", MCP_ALLOW_PUBLIC: "1" });
    expect(s.program.server.address()).toMatchObject({ address: "0.0.0.0" });
  });

  it("on SIGTERM: stops listening, writes the last usage bucket as ONE structured line, exits 143; SIGINT exits 130", async () => {
    const lines: { fields: Record<string, unknown>; message: string }[] = [];
    vi.spyOn(log, "info").mockImplementation(((fields: Record<string, unknown>, message: string) => { lines.push({ fields, message }); }) as never);
    const s = await start();
    s.program.usage.record({ door: "streamable", rpc: "tools/list", tool: null, client: "claude-ai", status: 200, ms: 12 });
    s.program.usage.record({ door: "streamable", rpc: "tools/list", tool: null, client: "claude-ai", status: 200, ms: 30 });
    expect([...s.signals.keys()].sort()).toEqual(["SIGINT", "SIGTERM"]);
    s.signals.get("SIGTERM")!();
    await vi.waitFor(() => { expect(s.exit).toHaveBeenCalled(); });
    expect(s.exit.mock.calls).toEqual([[EXIT_ON_SIGNAL.SIGTERM]]);
    expect(EXIT_ON_SIGNAL).toEqual({ SIGTERM: 143, SIGINT: 130 });
    expect(s.program.server.listening).toBe(false);
    const usage = lines.filter((l) => l.message === "mcp usage");
    expect(usage).toHaveLength(1);
    expect(usage[0]!.fields).toMatchObject({ period: "hour", door: "streamable", rpc: "tools/list", tool: "", client: "claude-ai", requests: 2, errors: 0, totalMs: 42, ms_le_100: 2 });
    const other = await start();
    other.signals.get("SIGINT")!();
    await vi.waitFor(() => { expect(other.exit).toHaveBeenCalled(); });
    expect(other.exit.mock.calls).toEqual([[EXIT_ON_SIGNAL.SIGINT]]);
  });

  it("a stop whose last write hangs still exits, at the deadline", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const s = await start();
      const hang = vi.spyOn(s.program.usage, "stop").mockImplementation(() => new Promise(() => undefined));
      void s.program.stop("SIGTERM");
      await vi.advanceTimersByTimeAsync(STOP_DEADLINE_MS - 1);
      expect(s.exit).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(s.exit.mock.calls).toEqual([[143]]);
      hang.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("env.ts: main's MCP_* keys, bounds and defaults", () => {
  it("defaults", () => {
    expect(mcpEnv({})).toEqual({
      MCP_HOST: "127.0.0.1", MCP_PORT: 8787, MCP_ALLOWED_ORIGINS: "http://127.0.0.1:8787,http://localhost:8787", MCP_LOG_LEVEL: "info", MCP_ALLOW_PUBLIC: "0",
      MCP_SESSION_TTL_S: 1800, MCP_SESSION_SWEEP_S: 60, MCP_MAX_BODY_KB: 64, MCP_IP_MAX_INFLIGHT: 8, MCP_IP_RATE_PER_MIN: 240, MCP_IP_RATE_BURST: 60,
      MCP_TRUSTED_PROXY_CIDR: "", MCP_MAX_SESSIONS: 500, MCP_MAX_SESSIONS_PER_ADDRESS: 0,
    });
  });

  it("HOST, PORT and LOG_LEVEL fill the MCP_ names only when those are unset; an empty value is absent", () => {
    expect(mcpEnv({ HOST: "0.0.0.0", PORT: "8080", LOG_LEVEL: "warn" })).toMatchObject({ MCP_HOST: "0.0.0.0", MCP_PORT: 8080, MCP_LOG_LEVEL: "warn" });
    expect(mcpEnv({ HOST: "0.0.0.0", MCP_HOST: "127.0.0.1", PORT: "8080", MCP_PORT: "9001" })).toMatchObject({ MCP_HOST: "127.0.0.1", MCP_PORT: 9001 });
    expect(mcpEnv({ MCP_PORT: "" }).MCP_PORT).toBe(8787);
  });

  it("refuses a value out of bounds at boot, naming its key", () => {
    for (const [key, value] of [["MCP_PORT", "0"], ["MCP_SESSION_TTL_S", "59"], ["MCP_SESSION_SWEEP_S", "9"], ["MCP_MAX_BODY_KB", "2000"], ["MCP_IP_RATE_BURST", "0"], ["MCP_MAX_SESSIONS", "-1"], ["MCP_ALLOW_PUBLIC", "yes"], ["MCP_PUBLIC_URL", "not a url"]] as const) {
      expect(() => mcpEnv({ [key]: value }), key).toThrow(new RegExp(`^${key}: `, "u"));
    }
  });

  it("accepts the bind, loopback and the public URL's host as Host headers", () => {
    expect(allowedHostsOf(mcpEnv({ MCP_PORT: "8787", MCP_PUBLIC_URL: "https://mcp.viafrei.de/mcp" }))).toEqual(["127.0.0.1:8787", "localhost:8787", "127.0.0.1:8787", "mcp.viafrei.de"]);
  });
});

describe("deps.ts", () => {
  it("one API client from the environment and the catalogue", async () => {
    const { depsFromEnv } = await import("../src/deps.js");
    const d = depsFromEnv({ VIAFREI_API_URL: "http://127.0.0.1:1/", VIAFREI_API_KEY: "k" });
    expect(d.api.config).toEqual({ baseUrl: "http://127.0.0.1:1", key: "k" });
    expect(d.catalogue.tools.map((t) => t.name)).toContain("find_place");
  });
});

describe("log.ts", () => {
  it("logs at LOG_LEVEL, info without it, as the viafrei-mcp service", async () => {
    vi.stubEnv("LOG_LEVEL", "warn");
    expect((await import("../src/log.js")).log.level).toBe("warn");
    vi.resetModules();
    vi.stubEnv("LOG_LEVEL", undefined);
    const { log } = await import("../src/log.js");
    expect(log.level).toBe("info");
    expect(log.bindings()).toEqual({ service: "viafrei-mcp" });
  });

  it("redact masks a URL's credentials and every key, token, secret or id query value", async () => {
    const { redact } = await import("../src/log.js");
    expect(redact("GET https://localhost:pw@api.viafrei.de/v1?apiKey=abc&x=1&TOKEN=t&client_secret=s&session_id=9&q=Köln failed")).toBe(
      "GET https://***@api.viafrei.de/v1?apiKey=***&x=1&TOKEN=***&client_secret=***&session_id=***&q=Köln failed",
    );
    expect(redact("http://localhost@viafrei.de/c and http://viafrei.de/p@viafrei.de")).toBe("http://***@viafrei.de/c and http://viafrei.de/p@viafrei.de");
    expect(redact("no url, key=value")).toBe("no url, key=value");
    expect(redact("/x?token_v2=abc&idx=1")).toBe("/x?token_v2=***&idx=***");
  });
});
