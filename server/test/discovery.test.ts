/**
 * A proposed operation is asked only once the API's own OpenAPI document lists it: that document is read once per
 * process and API, kept for DISCOVERY_TTL_MS, and a failed read is reported (never "not offered") and said again
 * without a request until DISCOVERY_RETRY_MS has passed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError, DISCOVERY_RETRY_MS, DISCOVERY_TTL_MS, forgetDiscovery, OPENAPI_PATH } from "../src/api/client.js";

const BASE = "http://127.0.0.1";
const doc = (ids: readonly string[]) => ({ openapi: "3.1.0", paths: { "/v1/a": { get: { operationId: "listPlaces" }, parameters: [] }, "/v1/b": { get: { operationId: ids[0] }, post: { operationId: ids[1] } }, "/v1/c": null } });
const envelope = { data: { label: "x", location: { lat: 1, lon: 2 } }, meta: { generatedAt: "2026-11-25T00:00:00Z" } };

/** A fake API: the document's answer, every request's path. */
function fakeApi(document: () => Response) {
  const seen: string[] = [];
  const fetch = vi.fn(async (input: string | URL) => {
    const u = new URL(String(input));
    seen.push(u.pathname);
    if (u.pathname === OPENAPI_PATH) return document();
    return new Response(JSON.stringify(envelope), { status: 200 });
  });
  return { seen, api: new ApiClient({ baseUrl: BASE, key: "k", fetch: fetch as unknown as typeof globalThis.fetch }) };
}
const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status });

afterEach(() => {
  forgetDiscovery();
  vi.useRealTimers();
});

describe("which operations the API offers", () => {
  it("a contract operation is offered without a read; a proposed one as its document says, read once for every language", async () => {
    const { api, seen } = fakeApi(json(doc(["resolvePlace"])));
    expect(await api.offers("listPlaces")).toBe(true);
    expect(seen).toEqual([]);
    const [a, b] = await Promise.all([api.offers("resolvePlace"), api.withLanguage("en").offers("listStopBoards")]);
    expect([a, b]).toEqual([true, false]);
    expect(await api.offers("getStationPage")).toBe(false);
    expect(seen).toEqual([OPENAPI_PATH]);
  });

  it("an operation in the document is asked; one not in it is answered not_found with no request", async () => {
    const { api, seen } = fakeApi(json(doc(["x", "resolvePlace"])));
    expect((await api.get("resolvePlace", { q: "Sylt" })).data).toEqual(envelope.data);
    const err = await api.get("getStationPage", { stationId: "s" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).kind).toBe("not_found");
    expect(seen).toEqual([OPENAPI_PATH, "/v1/places/resolve"]);
  });

  it("the list is kept for its TTL and read again after it", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-25T00:00:00Z") });
    const { api, seen } = fakeApi(json(doc([])));
    await api.offers("resolvePlace");
    vi.setSystemTime(Date.now() + DISCOVERY_TTL_MS - 1);
    await api.offers("resolvePlace");
    expect(seen).toHaveLength(1);
    vi.setSystemTime(Date.now() + 1);
    await api.offers("resolvePlace");
    expect(seen).toHaveLength(2);
  });

  it("a 429 is reported as rate_limited and said again without a request until the retry; then read again", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-25T00:00:00Z") });
    let status = 429;
    const { api, seen } = fakeApi(() => new Response(JSON.stringify({ status, detail: "slow down" }), { status }));
    for (let i = 0; i < 2; i++) {
      const err = await api.get("resolvePlace", { q: "Sylt" }).catch((e: unknown) => e);
      expect((err as ApiError).kind).toBe("rate_limited");
      expect((err as ApiError).message).toBe(`the ViaFrei API's list of operations (${OPENAPI_PATH}) could not be read: the OpenAPI document: slow down`);
    }
    expect(seen).toEqual([OPENAPI_PATH]);
    vi.setSystemTime(Date.now() + DISCOVERY_RETRY_MS - 1);
    await expect(api.offers("resolvePlace")).rejects.toBeInstanceOf(ApiError);
    expect(seen).toHaveLength(1);
    status = 200;
    vi.setSystemTime(Date.now() + 1);
    await expect(api.offers("resolvePlace")).rejects.toBeInstanceOf(ApiError);
    expect(seen).toHaveLength(2);
  });

  it("a document not served (404), a body without paths or no answer is a failure, never \"not offered\"", async () => {
    const said: string[] = [];
    for (const document of [json({ status: 404, title: "Not Found" }, 404), json({ openapi: "3.1.0" }), json({ paths: null }), () => new Response("", { status: 200 }), () => { throw new TypeError("fetch failed"); }]) {
      forgetDiscovery();
      const err = await fakeApi(document).api.offers("resolvePlace").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).kind).toBe("unavailable");
      said.push((err as ApiError).message.replace(`the ViaFrei API's list of operations (${OPENAPI_PATH}) could not be read: `, ""));
    }
    expect(said).toEqual(["the OpenAPI document: Not Found", "the OpenAPI document answered 200 without a body", "the OpenAPI document answered 200 without a body",
      "the OpenAPI document answered 200 without a body", "the ViaFrei API did not answer the OpenAPI document: TypeError"]);
  });

  it("an operation that fails after the document listed it keeps its own failure", async () => {
    const fetch = vi.fn(async (input: string | URL) => (new URL(String(input)).pathname === OPENAPI_PATH
      ? new Response(JSON.stringify(doc(["resolvePlace"])), { status: 200 })
      : new Response(JSON.stringify({ detail: "gone" }), { status: 404 })));
    const api = new ApiClient({ baseUrl: BASE, key: "k", fetch: fetch as unknown as typeof globalThis.fetch });
    const err = await api.get("resolvePlace", { q: "Sylt" }).catch((e: unknown) => e);
    expect([(err as ApiError).kind, (err as ApiError).message, (err as ApiError).status]).toEqual(["not_found", "resolvePlace: gone", 404]);
  });
});
