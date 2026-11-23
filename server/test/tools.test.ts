import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { HttpResponse } from "msw";
import { calls, exampleOf, handlerFor, mockServer, problem } from "./api-mock.js";
import { connect, TEST_KEY, textOf } from "./harness.js";
import { HANDLERS } from "../src/tools/handlers.js";
import { WATCH_CREDIT } from "../src/tools/stop-watch.js";
import { loadCatalogue } from "../src/catalogue.js";
import { TOOL_CASES } from "./tool-cases.js";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  calls.length = 0;
});
afterAll(() => mockServer.close());

const at = { lat: 52.52, lon: 13.405 };

describe("every catalogue tool has a handler and a case", () => {
  it("covers the catalogue", () => {
    const names = loadCatalogue().tools.map((t) => t.name).sort();
    expect(Object.keys(HANDLERS).sort()).toEqual(names);
    expect([...TOOL_CASES.map((c) => c.tool), "stop_watch"].sort()).toEqual(names);
  });
});

describe("tools answer from the API contract's examples", () => {
  for (const c of TOOL_CASES) {
    it(`${c.tool} asks ${c.ops.join(", ")} and credits the sources`, async () => {
      const { client, close } = await connect();
      try {
        const r = await client.callTool({ name: c.tool, arguments: c.args });
        expect(r.isError, textOf(r)).not.toBe(true);
        expect(calls.map((x) => x.operationId)).toEqual(expect.arrayContaining(c.ops));
        for (const x of calls) expect(x.headers.get("x-api-key")).toBe(TEST_KEY);
        const meta = r._meta as { attribution: string; sources: string[] };
        const body = exampleOf(c.ops[c.ops.length - 1]!);
        const credited = (body.meta["attribution"] as { text: string }[] | undefined) ?? [];
        // A newly opened watch shows no provider data, so it credits the watch service alone, as today's
        // server does (attribution names what answered); each report it later gives names its own source.
        if (c.tool === "watch_situation") {
          expect(meta.attribution).toBe(WATCH_CREDIT.text);
          for (const a of credited) expect(textOf(r)).not.toContain(a.text);
        } else {
          // A road answer credits a weather family only for a weather reason in the lamp it shows, in the
          // summary form (today's ampel); check_road_status shows no lamp, so never.
          const data = body.data as { lampReasons?: { reason: string }[] };
          const weatherShown = c.tool === "check_autobahn_traffic" && (data.lampReasons ?? []).some((x) => x.reason === "weather_warning" || x.reason === "slippery");
          const road = c.tool === "check_autobahn_traffic" || c.tool === "check_road_status";
          for (const a of credited as { text: string; domain?: string }[]) {
            if (road && a.domain === "weather") {
              expect(meta.attribution).not.toContain(a.text);
              if (weatherShown) expect(meta.attribution).toContain("Datenbasis: Deutscher Wetterdienst, zusammengefasst");
              continue;
            }
            expect(meta.attribution).toContain(a.text);
            expect(textOf(r)).toContain(a.text);
          }
        }
        const purpose = ((body.meta["notes"] as { purpose: string[] } | undefined)?.purpose ?? [])[0];
        if (purpose !== undefined) {
          expect((r._meta as { purposeNote?: string }).purposeNote).toContain(purpose);
          expect(textOf(r)).toContain(purpose);
        }
      } finally {
        await close();
      }
    });
  }
});

describe("special cases", () => {
  it("an empty answer says so and still credits", async () => {
    const body = exampleOf("listFuelOptions");
    mockServer.use(handlerFor("listFuelOptions", () => HttpResponse.json({ ...body, data: [] })));
    const { client, close } = await connect();
    const r = await client.callTool({ name: "find_cheapest_fuel", arguments: { ...at, language: "en" } });
    expect(textOf(r)).toContain("No filling stations found.");
    expect((r._meta as { attribution: string }).attribution.length).toBeGreaterThan(0);
    await close();
  });

  it("a 404 is a sentence, not a crash", async () => {
    mockServer.use(handlerFor("getMotorwayConditions", () => problem(404, "not-found")));
    const { client, close } = await connect();
    const r = await client.callTool({ name: "check_autobahn_traffic", arguments: { roads: ["A999"], language: "en" } });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toEqual('No data for A999 — that is not a motorway number I know, so not a German motorway I can say anything about. 3 motorways are on record. Nearest real numbers: A100, A101, A102. Please check the number (e.g. "A9", "A100").');
    await close();
  });

  it("a 429 asks to wait", async () => {
    mockServer.use(handlerFor("listChargingOptions", () => problem(429, "rate-limited")));
    const { client, close } = await connect();
    const r = await client.callTool({ name: "find_charging_station", arguments: { ...at, language: "de" } });
    expect(textOf(r)).toContain("in einer Minute");
    await close();
  });

  const termsBody = () => {
    const body = exampleOf("listParkingOptions");
    return {
      ...body,
      meta: {
        ...body.meta,
        terms: [{ parameter: "accept_terms", accept: "sid-terms-1", id: "sid", version: "1", inForceFrom: "2026-04-10", providerTerms: "https://viafrei.de/terms#sid", texts: [] }],
      },
    };
  };

  it("SID without acceptance: the occupancy stays withheld and accept_terms is never sent", async () => {
    mockServer.use(handlerFor("listParkingOptions", () => HttpResponse.json(termsBody())));
    const { client, close } = await connect({ elicit: () => ({ action: "decline" }) });
    const r = await client.callTool({ name: "find_parking", arguments: { ...at, kind: "truck", language: "en" } });
    expect(r.isError).not.toBe(true);
    expect(calls.every((c) => !c.url.searchParams.has("accept_terms"))).toBe(true);
    await close();
  });

  it("SID with acceptance: asked once by elicitation, then accept_terms is passed and the condition note shown", async () => {
    let asked = 0;
    mockServer.use(handlerFor("listParkingOptions", () => HttpResponse.json(termsBody())));
    const { client, close } = await connect({
      elicit: () => {
        asked++;
        return { action: "accept", content: { accept: true } };
      },
    });
    const r = await client.callTool({ name: "find_parking", arguments: { ...at, kind: "truck", language: "en" } });
    await client.callTool({ name: "find_parking", arguments: { ...at, kind: "truck", language: "en" } });
    expect(asked).toBe(1);
    expect(calls.some((c) => c.url.searchParams.get("accept_terms") === "sid-terms-1")).toBe(true);
    expect((r._meta as { conditionNote?: string }).conditionNote).toContain("Truck-parking occupancy");
    await close();
  });

  it("a client without elicitation is never asked and accept_terms is never sent", async () => {
    mockServer.use(handlerFor("listParkingOptions", () => HttpResponse.json(termsBody())));
    const { client, close } = await connect();
    await client.callTool({ name: "find_parking", arguments: { ...at, language: "en" } });
    expect(calls.every((c) => !c.url.searchParams.has("accept_terms"))).toBe(true);
    await close();
  });

  it("watch_situation then stop_watch: the watch lives in the session", async () => {
    const { client, close } = await connect();
    await client.callTool({ name: "watch_situation", arguments: { kind: "road", key: "A1", language: "en" } });
    const list = await client.readResource({ uri: "viafrei://watches" });
    expect(JSON.parse((list.contents[0] as { text: string }).text)).toHaveLength(1);
    const r = await client.callTool({ name: "stop_watch", arguments: { watch_id: 1, language: "en" } });
    expect(textOf(r)).toContain("Watch ended: viafrei://watch/1.");
    await close();
  });

  it("a place name resolves through listPlaces", async () => {
    const { client, close } = await connect();
    await client.callTool({ name: "find_speed_cameras", arguments: { place: "Köln", language: "en" } });
    expect(calls.map((c) => c.operationId)).toEqual(["listPlaces", "listSpeedCameras"]);
    await close();
  });

  it("unsupported cases answer not-available and ask nothing", async () => {
    const { client, close } = await connect();
    const r = await client.callTool({ name: "find_parking", arguments: { ...at, kind: "disabled_badge", language: "en" } });
    expect(textOf(r)).toContain("not available through the ViaFrei API yet");
    expect(calls).toHaveLength(0);
    await close();
  });
});

describe("resources read from the API", () => {
  const uris = [
    "viafrei://attribution",
    "viafrei://coverage",
    "viafrei://status/feeds",
    "viafrei://gazetteer",
    "viafrei://addresses",
    "viafrei://rules/low-emission-zones",
    "viafrei://emergency",
    "viafrei://rules/electric-driving",
    "viafrei://rules/driving-in-germany",
    "viafrei://place/K%C3%B6ln",
  ];
  for (const uri of uris) {
    it(uri, async () => {
      const { client, close } = await connect();
      const r = await client.readResource({ uri });
      expect((r.contents[0] as { text: string }).text.length).toBeGreaterThan(0);
      await close();
    });
  }
});
