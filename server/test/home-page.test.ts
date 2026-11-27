/**
 * GET / (owner order): a browser (Accept text/html) gets the page with strict headers; an MCP client or curl
 * probing the base URL keeps the empty 404 it got before. The page ships compiled in, so the generated module
 * must equal the .html it is made from, and the page's catalogue must equal what the server registers.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { fetch as undiciFetch } from "undici";
import { ApiClient } from "../src/api/client.js";
import { createMcpApp } from "../src/app.js";
import { loadCatalogue } from "../src/catalogue.js";
import { HOME_PAGE_HTML } from "../src/content/home-page.js";
import { homePageCsp, inlineScripts, wantsHtml } from "../src/home-page.js";
import { API_BASE } from "./api-mock.js";
import { connect, TEST_KEY } from "./harness.js";

const appFetch = undiciFetch as unknown as typeof fetch;
const running: Server[] = [];
afterEach(async () => {
  for (const s of running.splice(0)) {
    s.closeAllConnections();
    await new Promise<void>((resolve) => s.close(() => resolve()));
  }
});

async function boot(): Promise<string> {
  const deps = { api: new ApiClient({ baseUrl: API_BASE, key: TEST_KEY }), catalogue: loadCatalogue() };
  const { app } = createMcpApp({ deps, allowedOrigins: [], allowedHosts: [], maxBodyKb: 64, sessionTtlMs: 60_000, sessionSweepMs: 60_000 });
  const server: Server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  running.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const BROWSER = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
const sha = (s: string): string => `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`;

describe("the compiled-in page", () => {
  it("equals content/home-page.html byte for byte (rerun scripts/gen-home-page.mjs after an edit)", () => {
    expect(HOME_PAGE_HTML).toBe(readFileSync(new URL("../src/content/home-page.html", import.meta.url), "utf8"));
  });

  it("is a full English document with the ViaFrei icon and names the endpoint", () => {
    expect(HOME_PAGE_HTML.startsWith("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">")).toBe(true);
    expect(HOME_PAGE_HTML).toContain("<link rel=\"icon\" href=\"https://viafrei.de/favicon.svg\">");
    expect(HOME_PAGE_HTML).toContain("https://mcp.viafrei.de/mcp");
    expect(HOME_PAGE_HTML.trimEnd().endsWith("</body>\n</html>")).toBe(true);
  });

  it("links only its own anchors, inline images and viafrei.de", () => {
    const links = [...HOME_PAGE_HTML.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1] ?? "");
    expect(links.length).toBeGreaterThan(0);
    expect(links.filter((l) => !l.startsWith("#") && !l.startsWith("data:image/") && !/^https:\/\/(?:mcp\.)?viafrei\.de(?:\/|$)/.test(l))).toEqual([]);
  });
});

describe("wantsHtml", () => {
  it.each([
    [BROWSER, true], ["TEXT/HTML; q=1", true], ["application/json, text/html", true],
    ["text/html;q=0.5", true], ["text/html;q=0", false], ["text/html; q=0.0", false], ["application/json, text/html;q=0", false],
    ["*/*", false], ["application/json, text/event-stream", false], ["text/event-stream", false], ["text/htmlx", false], [undefined, false], ["", false],
  ])("%s → %s", (accept, want) => { expect(wantsHtml(accept)).toBe(want); });
});

describe("GET/HEAD /", () => {
  it("a browser gets the page with the strict headers", async () => {
    const r = await appFetch(`${await boot()}/`, { headers: { accept: BROWSER } });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(r.headers.get("cache-control")).toBe("public, max-age=300");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(r.headers.get("vary")).toMatch(/\bAccept\b/);
    expect(r.headers.get("content-security-policy")).toBe(homePageCsp());
    expect(await r.text()).toBe(HOME_PAGE_HTML);
  });

  it("the CSP admits exactly the page's one inline script by its hash, and nothing else", () => {
    const scripts = inlineScripts(HOME_PAGE_HTML);
    expect(scripts).toHaveLength(1);
    expect((HOME_PAGE_HTML.match(/<script\b/g) ?? []).length).toBe(1);
    expect(homePageCsp()).toBe([
      "default-src 'none'", "img-src data: https://viafrei.de", "style-src 'unsafe-inline'",
      `script-src ${sha(scripts[0] ?? "")}`, "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
    ].join("; "));
    expect(homePageCsp("<script>a</script><script>b</script>")).toContain(`script-src ${sha("a")} ${sha("b")};`);
  });

  it.each([
    ["an MCP client", { accept: "application/json, text/event-stream" }],
    ["curl", { accept: "*/*" }],
    ["no Accept", {}],
  ])("%s keeps the empty 404", async (_who, headers: Record<string, string>) => {
    const r = await appFetch(`${await boot()}/`, { headers });
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("");
    expect(r.headers.get("vary")).toMatch(/\bAccept\b/);
    expect(r.headers.get("content-security-policy")).toBeNull();
    expect(r.headers.get("cache-control")).toBeNull();
  });

  it("HEAD follows the same rule: 200 with the page's headers for a browser, 404 otherwise", async () => {
    const base = await boot();
    const html = await appFetch(`${base}/`, { method: "HEAD", headers: { accept: BROWSER } });
    expect(html.status).toBe(200);
    expect(html.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(html.headers.get("content-security-policy")).toBe(homePageCsp());
    expect(await html.text()).toBe("");
    const probe = await appFetch(`${base}/`, { method: "HEAD", headers: { accept: "*/*" } });
    expect(probe.status).toBe(404);
    expect(probe.headers.get("content-type")).toBeNull();
  });

  it("the protocol endpoint is untouched: a browser's GET of another path still gets the JSON 404", async () => {
    const r = await appFetch(`${await boot()}/nothing-here`, { headers: { accept: BROWSER } });
    expect(r.status).toBe(404);
    expect(((await r.json()) as { error: { code: number } }).error.code).toBe(-32601);
  });
});

/** The page states the catalogue; a new tool, resource or prompt turns this red until the page is updated. */
describe("the page's catalogue matches what the server registers", () => {
  const section = (from: string, to: string): string => {
    const a = HOME_PAGE_HTML.indexOf(`<h2 id="${from}">`);
    const b = HOME_PAGE_HTML.indexOf(`<h2 id="${to}">`);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    return HOME_PAGE_HTML.slice(a, b);
  };
  const rowNames = (html: string): string[] => [...html.matchAll(/<tr><td><code>([^<]+)<\/code><\/td>/g)].map((m) => m[1] ?? "");
  const cnt = (html: string): number => Number(/<span class="cnt">(\d+)<\/span>/.exec(html)?.[1]);

  it("tools, resources and prompts: names in the tables, every count", async () => {
    const { client, close } = await connect();
    const tools = (await client.listTools()).tools.map((t) => t.name);
    const resources = [
      ...(await client.listResources()).resources.map((r) => r.uri),
      ...(await client.listResourceTemplates()).resourceTemplates.map((r) => r.uriTemplate),
    ];
    const prompts = (await client.listPrompts()).prompts.map((p) => p.name);
    await close();
    const [t, r, p] = [tools.length, resources.length, prompts.length].map(String);

    const toolHtml = section("tools", "resources");
    expect([...rowNames(toolHtml)].sort()).toEqual([...tools].sort());
    expect(cnt(toolHtml)).toBe(tools.length);
    expect(HOME_PAGE_HTML).toContain(`<span class="n">${t} tools</span>`);
    expect(HOME_PAGE_HTML).toContain(`<span>${t} tools over Streamable HTTP`);
    expect(HOME_PAGE_HTML).toContain(`<li><b>${t}</b> tools</li>`);
    expect((HOME_PAGE_HTML.match(/\b\d+ tools\b/g) ?? []).every((s) => s === `${t} tools`)).toBe(true);

    const resourceHtml = section("resources", "prompts");
    expect([...rowNames(resourceHtml)].sort()).toEqual([...resources].sort());
    expect(cnt(resourceHtml)).toBe(resources.length);

    const promptHtml = section("prompts", "protocol");
    expect([...rowNames(promptHtml)].sort()).toEqual([...prompts].sort());
    expect(cnt(promptHtml)).toBe(prompts.length);

    expect(HOME_PAGE_HTML).toContain(`For developers: ${t} tools, ${r} resources, ${p} prompts`);
    expect(HOME_PAGE_HTML).toContain(`<li><b>${r}</b> resources, <b>${p}</b> prompts</li>`);
  });

  it("the coverage legend names the tools table's groups with their row counts, and the bar is proportional", () => {
    const groups: [string, number][] = [];
    for (const m of section("tools", "resources").matchAll(/<tr class="grp"><td colspan="2">([^<]+)<\/td><\/tr>|<tr><td><code>/g)) {
      if (m[1] !== undefined) groups.push([m[1], 0]);
      else { const last = groups.at(-1); expect(last).toBeDefined(); if (last) last[1] += 1; }
    }
    const legend = [...HOME_PAGE_HTML.matchAll(/<i class="dot" style="background:(#[0-9a-f]{6})"><\/i>([^<]+?) (\d+)<\/span>/g)]
      .map((m) => ({ colour: m[1], group: m[2], n: Number(m[3]) }));
    expect(legend.map((l) => [l.group, l.n])).toEqual(groups);
    const total = groups.reduce((n, [, k]) => n + k, 0);
    const bar = /<div class="langs"[^>]*>\s*((?:<i [^>]*><\/i>)+)/.exec(HOME_PAGE_HTML)?.[1] ?? "";
    const segments = [...bar.matchAll(/width:(\d+)%;background:(#[0-9a-f]{6})/g)].map((m) => ({ width: Number(m[1]), colour: m[2] }));
    expect(segments.map((s) => s.colour)).toEqual(legend.map((l) => l.colour));
    expect(segments.reduce((n, s) => n + s.width, 0)).toBe(100);
    segments.forEach((s, i) => { expect(Math.abs(s.width - (100 * (legend[i]?.n ?? 0)) / total)).toBeLessThan(1); });
  });
});
