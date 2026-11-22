/**
 * The pieces every answer goes through: the API client (configuration, URL, key, failures), the result
 * envelope (footer, `_meta`, notes, licences, the length cap), the person-worded API failures, the Berlin
 * times, and the truck-parking consent asked once per session.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { HttpResponse } from "msw";
import { ApiClient, ApiError, apiConfigFromEnv, atParam } from "../src/api/client.js";
import { apiFailure, berlinDateTime, berlinTime, eur, km, languageOf, notAvailable, toolResult, TOOL_RESULT_CHARS } from "../src/presentation.js";
import { outcomeOf, SID_CONDITION_NOTE, SID_CONSENT_TIMEOUT_MS, SID_TERMS_URL, SidConsent, sidElicitation } from "../src/sid-consent.js";
import { SessionWatches } from "../src/tools/context.js";
import { API_BASE, calls, handlerFor, mockServer } from "./api-mock.js";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  calls.length = 0;
});
afterAll(() => mockServer.close());

describe("ApiClient", () => {
  it("configuration: a positive timeout is kept, anything else left to the default", () => {
    expect(apiConfigFromEnv({ VIAFREI_API_TIMEOUT_MS: "3000", VIAFREI_API_URL: " http://127.0.0.1// ", VIAFREI_API_KEY: "  " })).toEqual({ baseUrl: "http://127.0.0.1", key: null, timeoutMs: 3000 });
    for (const t of ["0", "-5", "soon", ""]) expect(apiConfigFromEnv({ VIAFREI_API_TIMEOUT_MS: t })).not.toHaveProperty("timeoutMs");
    expect(apiConfigFromEnv({ VIAFREI_API_URL: "   " }).baseUrl).toBe("https://api.viafrei.de");
  });

  it("at: six decimals at most, no trailing zeros", () => {
    expect(atParam({ lat: 52.1234567, lon: 13.4 })).toBe("52.123457,13.4");
  });

  it("a path parameter left out is an invalid request, made to nobody", async () => {
    const api = new ApiClient({ baseUrl: API_BASE, key: "k" });
    for (const v of [undefined, null, ""]) expect(() => api.url("listStationDepartures", { stationId: v })).toThrow(new ApiError("invalid", "listStationDepartures needs stationId"));
    expect(api.url("listPlaces", { q: "x", limit: 0, kind: null })).toBe(`${API_BASE}/v1/places?q=x&limit=0`);
  });

  it("without a key only health, readiness and meta are asked, and without the key header", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: {}, meta: {} }), { status: 200 }));
    const api = new ApiClient({ baseUrl: API_BASE, key: null, fetch: fetch as unknown as typeof globalThis.fetch });
    for (const op of ["getHealth", "getReadiness", "getMeta"] as const) await api.get(op);
    expect(fetch).toHaveBeenCalledTimes(3);
    for (const call of fetch.mock.calls as unknown as [string, { headers: Record<string, string>; method: string }][]) {
      expect(call[1].headers).toEqual({ accept: "application/json" });
      expect(call[1].method).toBe("GET");
    }
    await expect(api.get("listPlaces", { q: "x" })).rejects.toMatchObject({ kind: "not_configured", message: "the ViaFrei API key is not configured (VIAFREI_API_KEY); no request was made" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("a write sends POST, its JSON body and content type; a read sends no body", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: {}, meta: {} }), { status: 201 }));
    const api = new ApiClient({ baseUrl: API_BASE, key: "k", fetch: fetch as unknown as typeof globalThis.fetch, timeoutMs: 50 });
    await api.post("createRefresh", { source: "s" });
    await api.get("listPlaces", { q: "x" });
    const [w, r] = fetch.mock.calls as unknown as [[string, RequestInit], [string, RequestInit]];
    expect(w[0]).toBe(`${API_BASE}/v1/refreshes`);
    expect(w[1]).toMatchObject({ method: "POST", headers: { accept: "application/json", "x-api-key": "k", "content-type": "application/json" }, body: '{"source":"s"}' });
    expect(r[1]).not.toHaveProperty("body");
    expect(r[1].headers).toEqual({ accept: "application/json", "x-api-key": "k" });
    expect(r[1].signal).toBeInstanceOf(AbortSignal);
  });

  it("an API that does not answer in time is unavailable, named by the error, no URL", async () => {
    const slow = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason))));
    const api = new ApiClient({ baseUrl: API_BASE, key: "k", fetch: slow as unknown as typeof globalThis.fetch, timeoutMs: 20 });
    await expect(api.get("listPlaces")).rejects.toMatchObject({ kind: "unavailable", message: "the ViaFrei API did not answer listPlaces: TimeoutError" });
    const thrower = new ApiClient({ baseUrl: API_BASE, key: "k", fetch: (async () => { throw "boom"; }) as unknown as typeof globalThis.fetch });
    await expect(thrower.get("listPlaces")).rejects.toMatchObject({ message: "the ViaFrei API did not answer listPlaces: error" });
  });

  it("a 2xx without an envelope is unavailable; a failure's detail falls back to its title, then the status", async () => {
    const api = new ApiClient({ baseUrl: API_BASE, key: "k" });
    for (const [status, body] of [[200, ""], [200, "not json"], [200, "[1]"], [200, '"x"'], [204, null]] as const) {
      mockServer.use(handlerFor("listPlaces", () => new HttpResponse(body, { status })));
      await expect(api.get("listPlaces")).rejects.toMatchObject({ kind: "unavailable", status, message: `listPlaces answered ${status} without a body` });
    }
    mockServer.use(handlerFor("listPlaces", () => HttpResponse.json({ title: "Bad thing" }, { status: 422 })));
    await expect(api.get("listPlaces")).rejects.toMatchObject({ kind: "invalid", message: "listPlaces: Bad thing", problem: { title: "Bad thing" } });
    mockServer.use(handlerFor("listPlaces", () => new HttpResponse("oops", { status: 502 })));
    await expect(api.get("listPlaces")).rejects.toMatchObject({ kind: "unavailable", status: 502, message: "listPlaces: HTTP 502", problem: null });
    mockServer.use(handlerFor("listPlaces", () => new HttpResponse("", { status: 299 })));
    await expect(api.get("listPlaces")).rejects.toMatchObject({ status: 299, message: "listPlaces answered 299 without a body" });
    mockServer.use(handlerFor("listPlaces", () => HttpResponse.json({ detail: "gone" }, { status: 300 })));
    await expect(api.get("listPlaces")).rejects.toMatchObject({ kind: "unavailable", status: 300, message: "listPlaces: gone" });
    expect(new ApiError("invalid", "m")).toMatchObject({ name: "ApiError", status: null, problem: null });
  });
});

describe("the result envelope", () => {
  const meta = (o: Record<string, unknown> = {}) => ({ requestId: "r", generatedAt: "2026-03-30T00:00:00Z", language: "de", ...o });
  const a = (family: string, text: string, o: Record<string, unknown> = {}) => ({ family, text, ...o });

  it("several reads: each source credited once, the oldest data time, the licences by family, notes once each", () => {
    const r = toolResult("Body", [
      meta({ asOf: "2026-03-30T00:10:00Z", attribution: [a("x", "X data", { licence: "CC BY 4.0" }), a("y", "Y data", { licence: "ODbL 1.0", shareAlike: true })], notes: { purpose: ["P1"], condition: ["C1"] } }),
      meta({ asOf: "2026-03-29T23:00:00Z", attribution: [a("x", "X again", { licence: "CC BY 4.0" }), a("z", "Z data")], notes: { purpose: ["P1", "P2"], condition: [] } }),
      meta({ asOf: null }),
    ], "en", { conditionNote: "C2", nextCursor: "n" });
    expect((r.content[0] as { text: string }).text).toBe("P1\nP2\nC1\nC2\nBody\n\nSource: X data · Y data · Z data · As of 2026-03-30 01:00");
    expect(r._meta).toEqual({
      attribution: "X data · Y data · Z data",
      license: "CC BY 4.0, ODbL 1.0",
      licenses: { x: "CC BY 4.0", y: "ODbL 1.0" },
      asOf: "2026-03-29T23:00:00Z",
      asOfLocal: "30/03/2026, 01:00",
      sources: ["x", "y", "z"],
      purposeNote: "P1 P2",
      conditionNote: "C1 C2",
      shareAlike: true,
      nextCursor: "n",
    });
    expect(r.isError).toBeUndefined();
  });

  it("no attribution and no data time: the generation time, no source line, nothing optional in _meta", () => {
    const r = toolResult("B", [meta({ attribution: [a("x", "X", { shareAlike: false })] }), meta()], "de", { nextCursor: null });
    expect((r.content[0] as { text: string }).text).toBe("B\n\nQuelle: X · Stand 30.03. 02:00");
    const bare = toolResult("B", [meta({ generatedAt: "2026-01-01T12:00:00Z" })], "de");
    expect((bare.content[0] as { text: string }).text).toBe("B\n\nStand 01.01. 13:00");
    expect(bare._meta).toEqual({ attribution: "", license: "", licenses: {}, asOf: "2026-01-01T12:00:00Z", asOfLocal: "01.01.2026, 13:00", sources: [] });
  });

  it("no read at all: the time of the answer", () => {
    vi.useFakeTimers({ now: new Date("2026-06-01T10:00:00Z"), toFake: ["Date"] });
    try {
      expect((toolResult("B", [], "en")._meta as { asOf: string }).asOf).toBe("2026-06-01T10:00:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a body longer than the cap is cut with an ellipsis so the notes and the footer stay whole", () => {
    expect(TOOL_RESULT_CHARS).toBe(8_000);
    const m = meta({ asOf: "2026-03-30T00:00:00Z", attribution: [a("x", "X")], notes: { purpose: ["Purpose."], condition: [] } });
    const footer = "Source: X · As of 2026-03-30 02:00";
    const room = 8_000 - footer.length - "Purpose.".length - 4;
    const fits = "b".repeat(room);
    expect((toolResult(fits, [m], "en").content[0] as { text: string }).text).toBe(`Purpose.\n${fits}\n\n${footer}`);
    const text = (toolResult(`${fits}c`, [m], "en").content[0] as { text: string }).text;
    expect(text).toBe(`Purpose.\n${"b".repeat(room - 1)}…\n\n${footer}`);
    expect(text.length).toBe(8_000 - 1);
    const tiny = (toolResult("x".repeat(9_000), [meta({ notes: { purpose: ["p".repeat(8_000)], condition: [] } })], "en").content[0] as { text: string }).text;
    expect(tiny.split("\n")[1]).toBe("…");
  });

  it("times in Berlin; a missing or broken time is a dash", () => {
    expect(berlinTime("2026-01-15T06:05:00Z")).toBe("07:05");
    expect(berlinTime("2026-07-15T06:05:00Z")).toBe("08:05");
    for (const v of [null, undefined, "nonsense"]) {
      expect(berlinTime(v)).toBe("–");
      expect(berlinDateTime(v, "de")).toBe("–");
    }
    expect(berlinDateTime("2026-07-15T22:30:00Z", "de")).toBe("16.07.2026, 00:30");
  });

  it("distances and prices, in each language's decimal sign", () => {
    expect([km(null, "de"), km(undefined, "en"), km(0, "de"), km(999.4, "en"), km(999.6, "en"), km(1000, "de"), km(12_345, "en")]).toEqual(["", "", "0 m", "999 m", "1000 m", "1,0 km", "12.3 km"]);
    expect([eur(1.6, "de"), eur(1.6, "en")]).toEqual(["1,600 €", "1.600 €"]);
    expect([languageOf("en"), languageOf("de"), languageOf("fr"), languageOf(undefined)]).toEqual(["en", "de", "de", "de"]);
  });

  it("an API failure in words for the person, never a URL or a key", () => {
    const say = (kind: ConstructorParameters<typeof ApiError>[0], language: "de" | "en", problem: Record<string, unknown> | null = null) =>
      (apiFailure(new ApiError(kind, "listPlaces: raw", 400, problem), language).content[0] as { text: string }).text;
    expect(say("not_found", "de")).toBe("Dazu hat die ViaFrei-API nichts gefunden.");
    expect(say("not_found", "en")).toBe("The ViaFrei API found nothing for this.");
    expect(say("invalid", "de", { detail: "lat out of range" })).toBe("Die Anfrage passt nicht: lat out of range");
    expect(say("invalid", "en")).toBe("The request does not fit: listPlaces: raw");
    expect(say("rate_limited", "en")).toBe("Too many requests right now – please ask again in a minute.");
    expect(say("refused", "de")).toBe("Diese Auskunft ist über die ViaFrei-API derzeit nicht verfügbar.");
    expect(say("not_configured", "en")).toBe("This answer is not available through the ViaFrei API yet.");
    expect(say("unavailable", "de")).toBe("Die ViaFrei-API antwortet gerade nicht – bitte gleich noch einmal fragen.");
    expect(say("unavailable", "en")).toBe("The ViaFrei API is not answering right now – please ask again shortly.");
    expect(apiFailure(new ApiError("unavailable", "x"), "en").isError).toBe(true);
    const bug = new TypeError("not an API failure");
    expect(() => apiFailure(bug, "en")).toThrow(bug);
    expect(notAvailable("en", "x").content[0]).toEqual({ type: "text", text: "This answer is not available through the ViaFrei API yet. (x)" });
  });
});

describe("the truck-parking consent", () => {
  const caps = (elicitation: unknown) => () => (elicitation === undefined ? undefined : { elicitation } as never);

  it("the question shows the condition note and the terms, in the person's language", () => {
    expect(SID_CONSENT_TIMEOUT_MS).toBe(120_000);
    for (const language of ["de", "en"] as const) {
      const q = sidElicitation(language);
      expect(q.message.startsWith(`${SID_CONDITION_NOTE[language]}\n\n`)).toBe(true);
      expect(SID_CONDITION_NOTE[language].endsWith(SID_TERMS_URL[language])).toBe(true);
      expect(q.requestedSchema).toMatchObject({ type: "object", required: ["accept"], properties: { accept: { type: "boolean" } } });
    }
    expect(sidElicitation("de").message.endsWith("Stimmen Sie zu?")).toBe(true);
    expect(sidElicitation("en").message.endsWith("Do you accept these terms?")).toBe(true);
    expect(sidElicitation("de").requestedSchema.properties["accept"]).toMatchObject({ title: "Ich stimme den Nutzungsbedingungen, Abschnitt 2, zu", description: "Ohne Zustimmung nennt ViaFrei die Lkw-Parkplätze ohne Belegung." });
    expect(sidElicitation("en").requestedSchema.properties["accept"]).toMatchObject({ title: "I accept the terms of use, section 2", description: "Without acceptance ViaFrei names the truck parks without occupancy." });
  });

  it("an answer counts as acceptance only with the box ticked", () => {
    expect(outcomeOf({ action: "accept", content: { accept: true } })).toBe("accepted");
    expect(outcomeOf({ action: "accept", content: { accept: false } })).toBe("declined");
    expect(outcomeOf({ action: "accept", content: { accept: "true" } })).toBe("not_answered");
    expect(outcomeOf({ action: "accept" })).toBe("not_answered");
    expect(outcomeOf({ action: "decline" })).toBe("declined");
    expect(outcomeOf({ action: "cancel" })).toBe("not_answered");
  });

  it("a client without elicitation is never asked", async () => {
    for (const e of [undefined, null, true]) {
      const send = vi.fn();
      const c = new SidConsent(caps(e));
      expect(c.supported()).toBe(false);
      expect(await c.ask("de", send)).toBe("unsupported");
      expect(send).not.toHaveBeenCalled();
    }
    expect(await new SidConsent(caps({})).ask("de", undefined)).toBe("unsupported");
  });

  it("asked once: the answer is remembered; two calls at once share one question", async () => {
    let answer!: (r: { action: "accept"; content: { accept: boolean } }) => void;
    const send = vi.fn(() => new Promise<never>((resolve) => (answer = resolve as never)));
    const c = new SidConsent(caps({}));
    expect(c.known()).toBeUndefined();
    const first = c.ask("en", send);
    const second = c.ask("en", send);
    answer({ action: "accept", content: { accept: true } });
    expect([await first, await second]).toEqual(["accepted", "accepted"]);
    expect(await c.ask("en", send)).toBe("accepted");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]).toEqual([sidElicitation("en")]);
  });

  it("a decline is remembered; a question not answered or failed is asked again", async () => {
    const c = new SidConsent(caps({}));
    const send = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce({ action: "cancel" }).mockResolvedValueOnce({ action: "decline" });
    expect(await c.ask("de", send)).toBe("not_answered");
    expect(await c.ask("de", send)).toBe("not_answered");
    expect(await c.ask("de", send)).toBe("declined");
    expect(await c.ask("de", send)).toBe("declined");
    expect(send).toHaveBeenCalledTimes(3);
    expect(c.known()).toBe("declined");
  });
});

describe("a session's watches", () => {
  it("numbered from 1, found, listed and removed", () => {
    const w = new SessionWatches();
    const one = { watchId: "a", uri: "u1", kind: "road", key: "A1" };
    expect(w.add(one)).toBe(1);
    expect(w.add({ ...one, watchId: "b", uri: "u2" })).toBe(2);
    expect(w.get(1)).toEqual(one);
    expect(w.find((x) => x.uri === "u2")).toBe(2);
    expect(w.find(() => false)).toBeUndefined();
    expect(w.list()).toEqual([{ id: 1, ...one }, { id: 2, ...one, watchId: "b", uri: "u2" }]);
    expect(w.remove(1)).toBe(true);
    expect(w.remove(1)).toBe(false);
    expect(w.add(one)).toBe(3);
  });
});

describe("the credit line in today's shape", () => {
  it("a row with its own label leads, a changed-data row goes last, no rows means the Stand alone; today's time has no day", async () => {
    const { creditFooter, standTime } = await import("../src/presentation.js");
    expect(creditFooter("de", ["A", "Datenbasis: DWD", "Quelle: Deutscher Wetterdienst"], "Stand 08:05")).toBe("Quelle: Deutscher Wetterdienst · A · Datenbasis: DWD · Stand 08:05");
    expect(creditFooter("en", ["A", "B"], "As of 08:05")).toBe("Source: A · B · As of 08:05");
    expect(creditFooter("de", ["Datenbasis: DWD"], "Stand 08:05")).toBe("Datenbasis: DWD · Stand 08:05");
    expect(creditFooter("de", [], "Stand 08:05")).toBe("Stand 08:05");
    const now = new Date("2026-09-18T10:00:00Z");
    expect(standTime("2026-09-18T06:05:00Z", "de", now)).toBe("08:05");
    expect(standTime("2026-09-17T21:59:00Z", "de", now)).toBe("17.09. 23:59");
    expect(standTime("2026-09-17T21:59:00Z", "en", now)).toBe("2026-09-17 23:59");
    expect(standTime("2026-09-17T22:00:00Z", "en", now)).toBe("00:00");
  });
});
