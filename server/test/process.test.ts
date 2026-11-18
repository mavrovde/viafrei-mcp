/**
 * The process wiring: the HTTP entrypoint listens where PORT and HOST say (its default port on loopback otherwise) and
 * leaves on SIGTERM and SIGINT once its server has closed; the dependencies come from the environment; the
 * logger's level and its redaction of credentials and keys in a URL.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("../src/app.js");
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("http.ts", () => {
  async function start(env: Record<string, string | undefined>) {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    const listen = vi.fn((_port: number, _host: string, cb: () => void) => {
      cb();
      return { close: (done: () => void) => done() };
    });
    const createApp = vi.fn(() => ({ listen }));
    vi.doMock("../src/app.js", () => ({ createApp }));
    const handlers = new Map<string, () => void>();
    vi.spyOn(process, "on").mockImplementation(((event: string, fn: () => void) => {
      handlers.set(event, fn);
      return process;
    }) as typeof process.on);
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    await import("../src/http.js");
    return { listen, createApp, handlers, exit };
  }

  it("listens on its default port on loopback, with the dependencies from the environment", async () => {
    const { listen, createApp } = await start({ PORT: undefined, HOST: undefined, VIAFREI_API_URL: "http://127.0.0.1/" });
    expect(listen.mock.calls[0]!.slice(0, 2)).toEqual([8_787, "127.0.0.1"]);
    const deps = (createApp.mock.calls[0] as unknown as [{ api: { config: { baseUrl: string } }; catalogue: { tools: unknown[] } }])[0];
    expect(deps.api.config.baseUrl).toBe("http://127.0.0.1");
    expect(deps.catalogue.tools.length).toBeGreaterThan(20);
  });

  it("listens where PORT and HOST say; SIGTERM and SIGINT close the server, then exit 0", async () => {
    const { listen, handlers, exit } = await start({ PORT: "8080", HOST: "0.0.0.0" });
    expect(listen.mock.calls[0]!.slice(0, 2)).toEqual([8080, "0.0.0.0"]);
    expect([...handlers.keys()].sort()).toEqual(["SIGINT", "SIGTERM"]);
    for (const signal of ["SIGTERM", "SIGINT"]) {
      exit.mockClear();
      handlers.get(signal)!();
      expect(exit).toHaveBeenCalledWith(0);
    }
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
