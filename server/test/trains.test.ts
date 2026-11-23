/**
 * get_train_departures: the live DB board through the API (createRefresh, getRefresh, getTrainBoard), every
 * answer from the API contract's v0.3.0 examples (test/fixtures/api-openapi.json), changed only where a
 * case needs it. No provider is asked: the server holds no provider client.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { API_BASE, calls, exampleOf, handlerFor, mockServer, problem, SPEC } from "./api-mock.js";
import { connect, textOf } from "./harness.js";

type Body = { data: Record<string, unknown>; meta: Record<string, unknown> };
type Examples = Record<string, { content?: Record<string, { examples?: Record<string, { value: unknown }> }> }>;

/** A 201 or 202 example of createRefresh, by its name in the contract. */
function refreshExample(status: "201" | "202", name: string): Body {
  const responses = SPEC.paths["/v1/refreshes"]!["post"]!.responses as Examples;
  return structuredClone(responses[status]!.content!["application/json"]!.examples![name]!.value) as Body;
}

const posted: unknown[] = [];
/** createRefresh answering `respond`, recording each body it was sent. */
const createRefresh = (respond: () => Response) =>
  http.post(`${API_BASE}/v1/refreshes`, async ({ request }) => {
    posted.push(await request.json());
    calls.push({ operationId: "createRefresh", url: new URL(request.url), headers: request.headers });
    return respond();
  });

/** The board example's one departure (ICE 578, planned 00:12Z) lies inside the window this `when` opens. */
const WHEN = "2026-03-30T00:00:00Z";
const stale = (fetchedAt: string | null = "2026-03-29T23:40:00Z", ageSeconds: number | null = 1_200): Body => {
  const b = exampleOf<Body>("getTrainBoard");
  b.data = { ...b.data, fresh: false, fetchedAt, ageSeconds, departures: [] };
  return b;
};

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  calls.length = 0;
  posted.length = 0;
});
afterAll(() => mockServer.close());

const ask = async (args: Record<string, unknown>, refreshWait = { totalMs: 2_000, pollMs: 5 }) => {
  const { client, close } = await connect({ refreshWait });
  try {
    return await client.callTool({ name: "get_train_departures", arguments: { language: "en", when: WHEN, ...args } });
  } finally {
    await close();
  }
};
const ops = (): string[] => calls.map((c) => c.operationId);

describe("get_train_departures with an EVA number: refresh, then the API's board", () => {
  it("settled at once (201 refreshed): asks train-board-de for the number and answers from getTrainBoard", async () => {
    mockServer.use(createRefresh(() => HttpResponse.json(refreshExample("201", "train-board"), { status: 201 })));
    const r = await ask({ eva_no: "8001001" });
    expect(r.isError, textOf(r)).not.toBe(true);
    expect(posted).toEqual([{ source: "train-board-de", subject: { eva: "8001001" } }]);
    expect(ops()).toEqual(["listStations", "createRefresh", "getTrainBoard"]);
    expect(calls.at(-1)!.url.pathname).toBe("/v1/train-boards/8001001");
    expect(textOf(r)).toContain("Departures from Schömpingbach Hbf (2026-03-30 02:00 to 03:00):");
    expect(textOf(r)).toContain("02:12 ICE 578 → Hamburg-Altona, platform 4, on time");
    expect(textOf(r)).toContain("Fahrplandaten: Deutsche Bahn AG, DB API Marketplace, CC BY 4.0, bearbeitet");
    expect((r._meta as { asOf: string }).asOf).toBe("2026-03-30T00:00:00Z");
  });

  it("pending (202), then refreshed on getRefresh: polls the refresh it was given, then answers the board", async () => {
    const settled = exampleOf<Body>("getRefresh");
    settled.data = { ...settled.data, id: "9", source: "train-board-de" };
    let reads = 0;
    mockServer.use(
      createRefresh(() => HttpResponse.json(refreshExample("202", "train-board-pending"), { status: 202 })),
      handlerFor("getRefresh", () => {
        reads += 1;
        return HttpResponse.json(reads < 2 ? { ...settled, data: { ...settled.data, state: "pending", settledAt: null, queue: { position: 1 } } } : settled);
      }),
    );
    const r = await ask({ eva_no: "8001001" });
    expect(r.isError, textOf(r)).not.toBe(true);
    expect(ops()).toEqual(["listStations", "createRefresh", "getRefresh", "getRefresh", "getTrainBoard"]);
    expect(calls.filter((c) => c.operationId === "getRefresh").every((c) => c.url.pathname === "/v1/refreshes/9")).toBe(true);
    expect(textOf(r)).toContain("ICE 578 → Hamburg-Altona");
  });

  it("timed out (still pending when the wait is spent): states the newest board's time, invents none, is no error", async () => {
    mockServer.use(
      createRefresh(() => HttpResponse.json(refreshExample("202", "train-board-pending"), { status: 202 })),
      handlerFor("getRefresh", () => HttpResponse.json(refreshExample("202", "train-board-pending"))),
      handlerFor("getTrainBoard", () => HttpResponse.json(stale())),
    );
    const started = Date.now();
    const r = await ask({ eva_no: "8001001" }, { totalMs: 60, pollMs: 10 });
    expect(Date.now() - started).toBeLessThan(1_500);
    expect(r.isError).not.toBe(true);
    expect(ops().at(-1)).toBe("getTrainBoard");
    expect(ops().filter((o) => o === "getRefresh").length).toBeGreaterThan(0);
    expect(textOf(r)).toContain("There is no current DB departure board for Schömpingbach Hbf right now; the newest held was fetched at 30/03/2026, 01:40 (20 min ago).");
    expect(textOf(r)).toContain("The refresh is still running");
    expect(textOf(r)).not.toContain("ICE 578");
    expect((r._meta as { asOf: string }).asOf).toBe("2026-03-29T23:40:00Z");
  });

  it("failed (201 failed) and no fresh board: a model-actionable error with the newest board's state", async () => {
    const failed = refreshExample("201", "fuel-failed");
    failed.data = { ...failed.data, source: "train-board-de" };
    mockServer.use(createRefresh(() => HttpResponse.json(failed, { status: 201 })), handlerFor("getTrainBoard", () => HttpResponse.json(stale(null, null))));
    const r = await ask({ eva_no: "8001001" });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain("none is held yet. DB's live departures are not reachable right now.");
    expect(ops()).toEqual(["listStations", "createRefresh", "getTrainBoard"]);
  });

  it("refused (201 refused) while the API still holds a fresh board: the board is answered", async () => {
    mockServer.use(createRefresh(() => HttpResponse.json(refreshExample("201", "train-board-refused"), { status: 201 })));
    const r = await ask({ eva_no: "8001001" });
    expect(r.isError, textOf(r)).not.toBe(true);
    expect(textOf(r)).toContain("ICE 578");
  });

  it("a refresh the key may not ask (403): the board is read as the API holds it", async () => {
    mockServer.use(createRefresh(() => problem(403, "scope-denied")), handlerFor("getTrainBoard", () => HttpResponse.json(stale())));
    const r = await ask({ eva_no: "8001001" });
    expect(r.isError).not.toBe(true);
    expect(textOf(r)).toContain("the newest held was fetched at");
    expect(textOf(r)).not.toContain("still running");
    expect(textOf(r)).not.toContain("not reachable");
  });

  it("a number the refresher refuses (400): names it and asks for the station's name; no board is read", async () => {
    mockServer.use(createRefresh(() => problem(400, "invalid-parameter", "body.subject.eva")));
    const r = await ask({ eva_no: "1234567" });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain("no station with the number 1234567");
    expect(ops()).not.toContain("getTrainBoard");
  });

  it("the window and the categories hold: a departure outside either is not listed", async () => {
    mockServer.use(createRefresh(() => HttpResponse.json(refreshExample("201", "train-board"), { status: 201 })));
    expect(textOf(await ask({ eva_no: "8001001", categories: ["RE"] }))).toContain("No RE train leaves Schömpingbach Hbf between 2026-03-30 02:00 and 03:00.\nStation asked: Schömpingbach Hbf (station number 8001001).");
    expect(textOf(await ask({ eva_no: "8001001", when: "2026-03-30T00:20:00Z" }))).toContain("No train leaves Schömpingbach Hbf between 2026-03-30 02:20 and 03:20.");
    expect(textOf(await ask({ eva_no: "8001001", categories: ["ICE"], duration_min: 15 }))).toContain("ICE 578");
  });
});

describe("get_train_departures with a station name", () => {
  it("asks every EVA number of the station (Station.evaNumbers) and lists a train filed under several once", async () => {
    mockServer.use(createRefresh(() => HttpResponse.json(refreshExample("201", "train-board"), { status: 201 })));
    const r = await ask({ station: "Schömpingbach Hbf" });
    expect(r.isError, textOf(r)).not.toBe(true);
    expect(posted.map((b) => (b as { subject: { eva: string } }).subject.eva).sort()).toEqual(["8001001", "8001002", "8001003"]);
    expect(calls.filter((c) => c.operationId === "getTrainBoard").map((c) => c.url.pathname).sort()).toEqual([
      "/v1/train-boards/8001001",
      "/v1/train-boards/8001002",
      "/v1/train-boards/8001003",
    ]);
    expect(textOf(r).match(/ICE 578/g)).toHaveLength(1);
    expect(ops()).not.toContain("listStationDepartures");
  });

  it("a stop that is no DB station (no EVA number) answers the API's own departure board", async () => {
    const list = exampleOf<{ data: unknown[]; meta: unknown }>("listStations");
    mockServer.use(handlerFor("listStations", () => HttpResponse.json({ ...list, data: [list.data[1]] })));
    const r = await ask({ station: "Schömpingbach Mitte" });
    expect(r.isError, textOf(r)).not.toBe(true);
    expect(ops()).toEqual(["listStations", "listStationDepartures"]);
  });
});

describe("find_place: the gazetteer's motorway places", () => {
  for (const kind of ["motorway", "junction"]) {
    it(`kind=${kind} asks listPlaces with that kind`, async () => {
      const { client, close } = await connect();
      const r = await client.callTool({ name: "find_place", arguments: { query: "A1", kind, language: "en" } });
      await close();
      expect(r.isError, textOf(r)).not.toBe(true);
      expect(ops()).toEqual(["listPlaces"]);
      expect(calls[0]!.url.searchParams.get("kind")).toBe(kind);
    });
  }
});
