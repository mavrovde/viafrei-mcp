/**
 * get_train_departures, what it answers: the board's lines (delay, cancellation, platform and its change,
 * line or category and number), the window, the categories, the limit, the order and the de-duplication
 * across a station's parts; a part whose board is not fresh; the waits; the station that is no DB station;
 * and every sentence in German and English. Built on the API contract's v0.3.0 examples.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { API_BASE, calls, exampleOf, handlerFor, mockServer, problem } from "./api-mock.js";
import { connect, textOf } from "./harness.js";
import { MAX_BOARD_PARTS, REFRESH_WAIT, TRAIN_BOARD_SOURCE } from "../src/tools/trains.js";

type Body = { data: Record<string, unknown>; meta: Record<string, unknown> };

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  calls.length = 0;
});
afterAll(() => mockServer.close());

const WHEN = "2026-03-30T00:00:00Z";
const LANGS = ["de", "en"] as const;
const settled = () => http.post(`${API_BASE}/v1/refreshes`, () => HttpResponse.json({ ...exampleOf<Body>("getRefresh"), data: { ...exampleOf<Body>("getRefresh").data, source: TRAIN_BOARD_SOURCE } }, { status: 201 }));
const ops = (): string[] => calls.map((c) => c.operationId);

const dep = (o: Record<string, unknown> = {}) => ({
  line: null, category: "ICE", number: "578", destination: "Hamburg-Altona", plannedAt: "2026-03-30T00:12:00Z", expectedAt: "2026-03-30T00:12:00Z",
  delayMin: 0, platform: "4", plannedPlatform: "4", platformChanged: false, cancelled: false, sourceFamily: "db_timetables", ...o,
});

/** getTrainBoard answering per EVA number: a board each, from the example. */
function boards(byEva: Record<string, Partial<{ fresh: boolean; fetchedAt: string | null; ageSeconds: number | null; departures: unknown[] }>>) {
  return handlerFor("getTrainBoard", (url) => {
    const eva = url.pathname.split("/").at(-1)!;
    const b = exampleOf<Body>("getTrainBoard");
    return HttpResponse.json({ ...b, data: { ...b.data, eva, ...(byEva[eva] ?? {}) } });
  });
}

async function ask(args: Record<string, unknown>, refreshWait = { totalMs: 2_000, pollMs: 5 }): Promise<CallToolResult> {
  const { client, close } = await connect({ refreshWait });
  try {
    return (await client.callTool({ name: "get_train_departures", arguments: { language: "en", when: WHEN, ...args } })) as CallToolResult;
  } finally {
    await close();
  }
}
const body = (r: CallToolResult): string => textOf(r).slice(0, textOf(r).lastIndexOf("\n\n"));

describe("the board's lines", () => {
  for (const language of LANGS) {
    it(`delay, cancellation, platform change, line or category and number, destination (${language})`, async () => {
      mockServer.use(settled(), boards({ "8001001": { departures: [
        dep({ plannedAt: "2026-03-30T00:30:00Z", expectedAt: "2026-03-30T00:35:00Z", delayMin: 5, platformChanged: true, platform: "7" }),
        dep({ plannedAt: "2026-03-30T00:20:00Z", line: "RE 1", category: "RE", cancelled: true, delayMin: 3, expectedAt: "2026-03-30T03:00:00Z" }),
        dep({ plannedAt: "2026-03-30T00:12:00Z", category: "S", number: "", destination: null, platform: null }),
        dep({ plannedAt: "2026-03-30T00:40:00Z", category: null, number: null }),
      ] } }));
      const r = await ask({ eva_no: "8001001", language });
      const head = "Schömpingbach Hbf:";
      expect(body(r)).toBe(language === "de"
        ? `${head}\n- 02:12 S → ?\n- 02:20 RE 1 → Hamburg-Altona · fällt aus · Gl. 4\n- 02:30 ICE 578 → Hamburg-Altona · +5 · Gl. 7!\n- 02:40 ? → Hamburg-Altona · Gl. 4`
        : `${head}\n- 02:12 S → ?\n- 02:20 RE 1 → Hamburg-Altona · cancelled · pl. 4\n- 02:30 ICE 578 → Hamburg-Altona · +5 · pl. 7!\n- 02:40 ? → Hamburg-Altona · pl. 4`);
      expect(textOf(r).endsWith(language === "de" ? "Stand 30.03. 02:00" : "As of 2026-03-30 02:00")).toBe(true);
    });
  }

  it("the window opens at `when` and closes duration_min later, by the expected time; the limit holds", async () => {
    mockServer.use(settled(), boards({ "8001001": { departures: [
      dep({ plannedAt: "2026-03-29T23:58:00Z", expectedAt: "2026-03-30T00:00:00Z", number: "1" }),
      dep({ plannedAt: "2026-03-29T23:50:00Z", expectedAt: "2026-03-29T23:59:59Z", number: "2" }),
      dep({ plannedAt: "2026-03-30T00:30:00Z", expectedAt: "2026-03-30T00:30:00Z", number: "3" }),
      dep({ plannedAt: "2026-03-30T00:29:00Z", expectedAt: "2026-03-30T00:30:01Z", number: "4" }),
    ] } }));
    expect(body(await ask({ eva_no: "8001001", duration_min: 30 }))).toBe("Schömpingbach Hbf:\n- 01:58 ICE 1 → Hamburg-Altona · pl. 4\n- 02:30 ICE 3 → Hamburg-Altona · pl. 4");
    expect(body(await ask({ eva_no: "8001001", duration_min: 30, limit: 1 }))).toBe("Schömpingbach Hbf:\n- 01:58 ICE 1 → Hamburg-Altona · pl. 4");
  });

  it("without duration_min the window is an hour, without a limit ten trains", async () => {
    const many = Array.from({ length: 12 }, (_, i) => dep({ number: String(100 + i), plannedAt: `2026-03-30T00:${String(10 + i).padStart(2, "0")}:00Z`, expectedAt: `2026-03-30T00:${String(10 + i).padStart(2, "0")}:00Z` }));
    mockServer.use(settled(), boards({ "8001001": { departures: [...many, dep({ number: "999", plannedAt: "2026-03-30T01:00:01Z", expectedAt: "2026-03-30T01:00:01Z" })] } }));
    const lines = body(await ask({ eva_no: "8001001" })).split("\n").slice(1);
    expect(lines).toHaveLength(10);
    expect(lines[9]).toContain("ICE 109");
    mockServer.use(boards({ "8001001": { departures: [dep({ number: "60", plannedAt: "2026-03-30T01:00:00Z", expectedAt: "2026-03-30T01:00:00Z" }), dep({ number: "61", plannedAt: "2026-03-30T01:00:01Z", expectedAt: "2026-03-30T01:00:01Z" })] } }));
    expect(body(await ask({ eva_no: "8001001" }))).toBe("Schömpingbach Hbf:\n- 03:00 ICE 60 → Hamburg-Altona · pl. 4");
  });

  it("a category filter drops a train without a category", async () => {
    mockServer.use(settled(), boards({ "8001001": { departures: [dep({ category: null, line: "X" }), dep({ category: "RE", number: "5" })] } }));
    expect(body(await ask({ eva_no: "8001001", categories: ["RE", "ICE"] }))).toBe("Schömpingbach Hbf:\n- 02:12 RE 5 → Hamburg-Altona · pl. 4");
  });

  it("an invalid `when` is refused before anything is asked of the board", async () => {
    for (const language of LANGS) {
      const r = await ask({ eva_no: "8001001", when: "soon", language });
      expect(r.isError).toBe(true);
      expect(textOf(r)).toBe("MCP error -32602: Input validation error: Invalid arguments for tool get_train_departures: Invalid ISO datetime at when");
    }
    expect(ops()).toEqual([]);
  });

  it("without `when` the window opens now", async () => {
    const soon = new Date(Date.now() + 10 * 60_000).toISOString();
    const past = new Date(Date.now() - 10 * 60_000).toISOString();
    mockServer.use(settled(), boards({ "8001001": { departures: [dep({ plannedAt: soon, expectedAt: soon, number: "1" }), dep({ plannedAt: past, expectedAt: past, number: "2" })] } }));
    const { client, close } = await connect({ refreshWait: { totalMs: 100, pollMs: 5 } });
    const r = (await client.callTool({ name: "get_train_departures", arguments: { eva_no: "8001001", language: "en" } })) as CallToolResult;
    await close();
    expect(body(r)).toContain("ICE 1 →");
    expect(body(r)).not.toContain("ICE 2 →");
  });
});

describe("a station of several parts", () => {
  it("asks at most four parts, merges their trains in time order, lists a train filed twice once", async () => {
    const list = exampleOf<Body & { data: Record<string, unknown>[] }>("listStations");
    list.data[0] = { ...list.data[0], evaNumbers: ["1", "2", "3", "4", "5"] };
    mockServer.use(
      handlerFor("listStations", () => HttpResponse.json(list)),
      settled(),
      boards({
        "1": { departures: [dep({ number: "20", plannedAt: "2026-03-30T00:20:00Z", expectedAt: "2026-03-30T00:20:00Z" })], fetchedAt: "2026-03-30T00:00:30Z" },
        "2": { departures: [dep({ number: "10", plannedAt: "2026-03-30T00:10:00Z", expectedAt: "2026-03-30T00:10:00Z" }), dep({ number: "20", plannedAt: "2026-03-30T00:20:00Z", expectedAt: "2026-03-30T00:20:00Z" })], fetchedAt: "2026-03-30T00:00:10Z" },
        "3": { departures: [dep({ number: "20", plannedAt: "2026-03-30T00:20:00Z", expectedAt: "2026-03-30T00:20:00Z", destination: "Kiel" })] },
        "4": { fresh: false, fetchedAt: "2026-03-29T23:00:00Z", ageSeconds: 3_600, departures: [] },
      }),
    );
    expect(MAX_BOARD_PARTS).toBe(4);
    const r = await ask({ station: "Schömpingbach Hbf" });
    expect(calls.filter((c) => c.operationId === "getTrainBoard").map((c) => c.url.pathname.split("/").at(-1)).sort()).toEqual(["1", "2", "3", "4"]);
    expect(body(r)).toBe(
      "Schömpingbach Hbf:\n- 02:10 ICE 10 → Hamburg-Altona · pl. 4\n- 02:20 ICE 20 → Hamburg-Altona · pl. 4\n- 02:20 ICE 20 → Kiel · pl. 4\n" +
        "There is no current DB departure board for Schömpingbach Hbf (4) right now; the newest held was fetched at 30/03/2026, 01:00 (60 min ago).",
    );
    expect((r._meta as { asOf: string }).asOf).toBe("2026-03-30T00:00:00Z");
  });

  it("no part fresh: the newest board held is named, in German too", async () => {
    mockServer.use(settled(), boards({
      "8001001": { fresh: false, fetchedAt: "2026-03-29T22:00:00Z", ageSeconds: 7_200, departures: [] },
      "8001002": { fresh: false, fetchedAt: "2026-03-29T23:30:00Z", ageSeconds: 1_800, departures: [] },
      "8001003": { fresh: false, fetchedAt: null, ageSeconds: null, departures: [] },
    }));
    const r = await ask({ station: "Schömpingbach Hbf", language: "de" });
    expect(r.isError).toBeUndefined();
    expect(body(r)).toBe("Für Schömpingbach Hbf liegt gerade keine aktuelle Abfahrtstafel der DB vor; die neueste ist vom 30.03.2026, 01:30 (vor 30 min).");
    expect((r._meta as { asOf: string }).asOf).toBe("2026-03-29T23:30:00Z");
  });
});

describe("the refresh", () => {
  it("waits the default 3 s at most, asking every 250 ms", () => {
    expect(REFRESH_WAIT).toEqual({ totalMs: 3_000, pollMs: 250 });
  });

  it("failed for every part, nothing fresh, German: an error naming that DB is not reachable and that none is held", async () => {
    const failed = exampleOf<Body>("getRefresh");
    mockServer.use(
      http.post(`${API_BASE}/v1/refreshes`, () => HttpResponse.json({ ...failed, data: { ...failed.data, state: "failed", reason: "upstream https://api.viafrei.de/x?key=1" } }, { status: 201 })),
      boards({ "8001001": { fresh: false, fetchedAt: null, ageSeconds: null, departures: [] } }),
    );
    const r = await ask({ eva_no: "8001001", language: "de" });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toBe("Für Schömpingbach Hbf liegt gerade keine aktuelle Abfahrtstafel der DB vor; es liegt noch keine vor. Die Live-Abfahrten der DB sind gerade nicht erreichbar.");
  });

  it("a refresh that cannot be read again counts as still running; German wording", async () => {
    mockServer.use(
      http.post(`${API_BASE}/v1/refreshes`, () => HttpResponse.json({ ...exampleOf<Body>("getRefresh"), data: { ...exampleOf<Body>("getRefresh").data, state: "pending", id: "7" } }, { status: 202 })),
      handlerFor("getRefresh", () => problem(503, "unavailable")),
      boards({ "8001001": { fresh: false, fetchedAt: "2026-03-29T23:40:00Z", ageSeconds: null, departures: [] } }),
    );
    const r = await ask({ eva_no: "8001001", language: "de" });
    expect(r.isError).toBeUndefined();
    expect(ops()).toEqual(["listStations", "getRefresh", "getTrainBoard"]);
    expect(body(r)).toBe("Für Schömpingbach Hbf liegt gerade keine aktuelle Abfahrtstafel der DB vor; die neueste ist vom 30.03.2026, 01:40. Die Aktualisierung läuft noch – bitte gleich noch einmal fragen.");
  });

  it("a wait already spent asks the refresh no second time", async () => {
    mockServer.use(
      http.post(`${API_BASE}/v1/refreshes`, () => HttpResponse.json({ ...exampleOf<Body>("getRefresh"), data: { ...exampleOf<Body>("getRefresh").data, state: "pending" } }, { status: 202 })),
      boards({ "8001001": { fresh: false, fetchedAt: null, ageSeconds: null, departures: [] } }),
    );
    const r = await ask({ eva_no: "8001001" }, { totalMs: 0, pollMs: 5 });
    expect(ops()).toEqual(["listStations", "getTrainBoard"]);
    expect(textOf(r)).toContain("The refresh is still running");
  });

  it("a refresher that is rate limited: the tool says to wait, no board is read", async () => {
    mockServer.use(http.post(`${API_BASE}/v1/refreshes`, () => problem(429, "rate-limited")));
    const r = await ask({ eva_no: "8001001" });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toBe("Too many requests right now – please ask again in a minute.");
    expect(ops()).not.toContain("getTrainBoard");
  });

  it("a refresher that does not answer: the board as the API holds it", async () => {
    mockServer.use(http.post(`${API_BASE}/v1/refreshes`, () => HttpResponse.error()));
    const r = await ask({ eva_no: "8001001" });
    expect(body(r)).toBe("Schömpingbach Hbf:\n- 02:12 ICE 578 → Hamburg-Altona · pl. 4");
  });

  it("a number the refresher refuses, in German", async () => {
    mockServer.use(http.post(`${API_BASE}/v1/refreshes`, () => problem(400, "invalid-parameter")));
    const r = await ask({ eva_no: "1234567", language: "de" });
    expect(textOf(r)).toBe("Die DB-Fahrplanschnittstelle kennt keinen Bahnhof mit der Nummer 1234567. Bitte den Bahnhofsnamen nennen.");
  });
});

describe("which station", () => {
  for (const language of LANGS) {
    it(`neither a station nor a number (${language}): asks for one, asks nothing`, async () => {
      const r = await ask({ language });
      expect(r.isError).toBe(true);
      expect(textOf(r)).toBe(language === "de" ? "Bitte einen Bahnhof (station) oder eine EVA-Nummer angeben." : "Please give a station or an EVA number.");
      expect(calls).toHaveLength(0);
    });
    it(`an unknown station name (${language}): an error naming it and how to say it, as before the move`, async () => {
      mockServer.use(handlerFor("listStations", () => HttpResponse.json({ ...exampleOf<Body>("listStations"), data: [] })));
      const r = await ask({ station: "Atlantis", language });
      expect(r.isError).toBe(true);
      expect(textOf(r)).toBe(language === "de"
        ? 'Den Bahnhof "Atlantis" kenne ich nicht. Bitte den Namen so nennen, wie er am Bahnhof steht (z. B. "Hamburg Hbf", "Köln Hbf").'
        : 'I do not know a station called "Atlantis". Please give the name as it appears at the station (e.g. "Hamburg Hbf", "Köln Hbf").');
      expect(ops()).toEqual(["listStations"]);
    });
  }

  it("a number the station search does not know: the board under the number itself", async () => {
    mockServer.use(handlerFor("listStations", () => HttpResponse.json({ ...exampleOf<Body>("listStations"), data: [] })), settled());
    const r = await ask({ eva_no: "8000105" });
    expect(calls[0]!.url.searchParams.get("code")).toBe("8000105");
    expect(calls[0]!.url.searchParams.get("q")).toBeNull();
    expect(body(r).split("\n")[0]).toBe("8000105:");
  });

  it("a station with one EVA number but no list of parts", async () => {
    const list = exampleOf<Body & { data: Record<string, unknown>[] }>("listStations");
    mockServer.use(handlerFor("listStations", () => HttpResponse.json({ ...list, data: [{ ...list.data[0], evaNumbers: [] }] })), settled());
    await ask({ station: "Schömpingbach Hbf" });
    expect(calls[0]!.url.searchParams.get("q")).toBe("Schömpingbach Hbf");
    expect(calls.filter((c) => c.operationId === "getTrainBoard").map((c) => c.url.pathname)).toEqual(["/v1/train-boards/8001001"]);
  });

  for (const language of LANGS) {
    it(`a stop that is no DB station (${language}): the API's departure board, rail only, every filter passed`, async () => {
      const list = exampleOf<Body & { data: Record<string, unknown>[] }>("listStations");
      const board = exampleOf<Body>("listStationDepartures");
      const d = (o: Record<string, unknown>) => ({ line: "RB 5", category: "RB", mode: "rail", destination: "Ulm", plannedAt: "2026-03-30T06:05:00Z", delayMin: null, cancelled: false, platform: "2", platformChanged: false, ...o });
      mockServer.use(
        handlerFor("listStations", () => HttpResponse.json({ ...list, data: [list.data[1]] })),
        handlerFor("listStationDepartures", () => HttpResponse.json({ ...board, data: { ...board.data, departures: [d({}), d({ delayMin: 6, platform: null, line: null }), d({ cancelled: true, line: null, category: null, destination: null }), d({ delayMin: 0 })] } })),
      );
      const r = await ask({ station: "Schömpingbach Mitte", when: "2026-03-30T08:00:00+02:00", duration_min: 30, categories: ["RB"], limit: 4, language });
      expect(Object.fromEntries(calls.find((c) => c.operationId === "listStationDepartures")!.url.searchParams)).toEqual({ from: "2026-03-30T08:00:00+02:00", duration_min: "30", categories: "RB", modes: "rail", limit: "4", lang: language });
      const [pl, gone] = language === "de" ? ["Gl.", "fällt aus"] : ["pl.", "cancelled"];
      expect(body(r)).toBe(`Pienköckheim Nord:\n- 08:05 RB 5 → Ulm · ${pl} 2\n- 08:05 RB → Ulm · +6\n- 08:05  → ? · ${gone} · ${pl} 2\n- 08:05 RB 5 → Ulm · ${pl} 2`);
      expect((r._meta as { sources: string[] }).sources).toEqual(["bkg_gvisys", "delfi_static"]);
    });
    it(`a stop that is no DB station, nothing in the window (${language})`, async () => {
      const list = exampleOf<Body & { data: Record<string, unknown>[] }>("listStations");
      mockServer.use(handlerFor("listStations", () => HttpResponse.json({ ...list, data: [list.data[1]] })));
      expect(body(await ask({ station: "Schömpingbach Mitte", language }))).toBe(`Pienköckheim Nord: ${language === "de" ? "keine Abfahrten im Zeitfenster." : "no departures in the window."}`);
    });
  }
});

describe("structuredContent: the shape the server sent before the move", () => {
  const META = { asOf: expect.any(String), attribution: expect.stringContaining("Deutsche Bahn"), license: expect.stringContaining("CC BY 4.0") };

  it("a fresh board: station, numbers, window, categories and every listed departure, with asOf, attribution and licence", async () => {
    mockServer.use(settled(), boards({ "8001001": { departures: [
      dep({ plannedAt: "2026-03-30T00:30:00Z", expectedAt: "2026-03-30T00:35:00Z", delayMin: 5, platformChanged: true, platform: "7" }),
      dep({ plannedAt: "2026-03-30T00:20:00Z", line: "RE 1", category: "RE", cancelled: true }),
    ] } }));
    const r = await ask({ eva_no: "8001001", duration_min: 90, categories: ["ICE", "RE"] });
    expect(r.isError).toBeFalsy();
    const sc = r.structuredContent as Record<string, unknown>;
    expect(sc).toEqual({
      station: expect.any(String), evaNo: "8001001", evaNos: ["8001001"], windowMin: 90, categories: ["ICE", "RE"],
      departures: [
        { line: "RE 1", category: "RE", destination: "Hamburg-Altona", plannedAt: "2026-03-30T00:20:00Z", expectedAt: "2026-03-30T00:12:00Z", delayMin: 0, platform: "4", plannedPlatform: "4", platformChanged: false, cancelled: true },
        { line: "ICE 578", category: "ICE", destination: "Hamburg-Altona", plannedAt: "2026-03-30T00:30:00Z", expectedAt: "2026-03-30T00:35:00Z", delayMin: 5, platform: "7", plannedPlatform: "4", platformChanged: true, cancelled: false },
      ],
      ...META,
    });
    expect(sc["asOf"]).toBe((r._meta as Record<string, unknown>)["asOf"]);
    expect(sc["attribution"]).toBe((r._meta as Record<string, unknown>)["attribution"]);
  });

  it("no category asked: no categories key; the window defaults to 60", async () => {
    mockServer.use(settled(), boards({}));
    const sc = (await ask({ eva_no: "8001001" })).structuredContent as Record<string, unknown>;
    expect(sc).not.toHaveProperty("categories");
    expect(sc["windowMin"]).toBe(60);
    expect(sc["departures"]).toHaveLength(1);
  });

  it("a board that is not current: no departure, DB marked as not answered", async () => {
    mockServer.use(http.post(`${API_BASE}/v1/refreshes`, () => HttpResponse.json({ ...exampleOf<Body>("getRefresh"), data: { ...exampleOf<Body>("getRefresh").data, state: "pending" } }, { status: 202 })),
      handlerFor("getRefresh", () => HttpResponse.json({ ...exampleOf<Body>("getRefresh"), data: { ...exampleOf<Body>("getRefresh").data, state: "pending" } })),
      boards({ "8001001": { fresh: false, fetchedAt: "2026-03-29T23:40:00Z", ageSeconds: 1_200, departures: [] } }));
    const r = await ask({ eva_no: "8001001" }, { totalMs: 20, pollMs: 5 });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toEqual({ station: expect.any(String), evaNo: "8001001", evaNos: ["8001001"], windowMin: 60, departures: [], dbTimetables: { answered: false, reason: "unavailable" }, ...META });
  });

  it("a stop that is no DB station: the API board's departures, every field, the category where no line is given", async () => {
    const stations = exampleOf<Body>("listStations");
    const first = (stations.data as unknown as Record<string, unknown>[])[0]!;
    const board = exampleOf<Body>("listStationDepartures");
    const row = (o: Record<string, unknown>) => ({
      line: "RB 31", category: "RB", destination: "Teststadt Nord", plannedAt: "2026-03-30T00:20:00Z", expectedAt: "2026-03-30T00:24:00Z", delayMin: 4,
      platform: "2", plannedPlatform: "1", platformChanged: true, cancelled: false, mode: "rail", ...o,
    });
    mockServer.use(
      handlerFor("listStations", () => HttpResponse.json({ ...stations, data: [{ ...first, eva: null, evaNumbers: [] }] })),
      handlerFor("listStationDepartures", () => HttpResponse.json({ ...board, data: { ...board.data, station: { id: "st-1", name: "Teststadt Süd" }, departures: [
        row({}),
        row({ line: null, category: "S", destination: null, plannedAt: "2026-03-30T00:30:00Z", expectedAt: null, delayMin: null, platform: null, plannedPlatform: null, platformChanged: false, cancelled: true }),
      ] } })),
    );
    const r = await ask({ station: "Teststadt", duration_min: 30, categories: ["RB", "S"] });
    expect(r.structuredContent).toEqual({
      station: "Teststadt Süd", evaNo: null, evaNos: [], windowMin: 30, categories: ["RB", "S"],
      departures: [
        { line: "RB 31", category: "RB", destination: "Teststadt Nord", plannedAt: "2026-03-30T00:20:00Z", expectedAt: "2026-03-30T00:24:00Z", delayMin: 4, platform: "2", plannedPlatform: "1", platformChanged: true, cancelled: false },
        { line: "S", category: "S", destination: null, plannedAt: "2026-03-30T00:30:00Z", expectedAt: null, delayMin: null, platform: null, plannedPlatform: null, platformChanged: false, cancelled: true },
      ],
      asOf: expect.any(String), attribution: expect.any(String), license: expect.any(String),
    });
    expect(ops()).toContain("listStationDepartures");
  });
});
