/**
 * The live DB Timetables board: undici MockAgent stands in for DB (as the platform's own tests do), MSW
 * for the ViaFrei API. Synthetic payloads only.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher, type Dispatcher } from "undici";
import { calls, mockServer } from "./api-mock.js";
import { connect, textOf } from "./harness.js";
import { DbTimetablesClient, planPathParts } from "../src/vendor/db-timetables/client.js";
import { berlinWallClock } from "../src/vendor/db-timetables/berlin-time.js";
import { RateLimiter } from "../src/vendor/db-timetables/rate-limiter.js";

const EVA = "8000001";
const DB = "https://example.invalid";

function pt(d: Date): string {
  const w = berlinWallClock(d);
  const { date } = planPathParts(d);
  return `${date}${String(w.hour).padStart(2, "0")}${String(w.minute).padStart(2, "0")}`;
}

function planXml(at: Date): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<timetable station="Teststadt Hbf" eva="${EVA}">
  <s id="-7001-${pt(at)}-1">
    <tl f="N" t="p" o="80" c="RE" n="701"/>
    <dp pt="${pt(at)}" pp="3" l="7" ppth="Nordheim|Weststadt"/>
  </s>
</timetable>`;
}

let agent: MockAgent;
let previous: Dispatcher;

beforeAll(() => {
  previous = getGlobalDispatcher();
  mockServer.listen({ onUnhandledRequest: "bypass" });
});
beforeEach(() => {
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
});
afterEach(async () => {
  calls.length = 0;
  await agent.close();
  setGlobalDispatcher(previous);
});
afterAll(() => mockServer.close());

describe("get_train_departures with an EVA number: the live DB board", () => {
  it("asks /plan and /fchg through the limiter, renders the board, credits DB, and asks the API nothing", async () => {
    const at = new Date(Date.now() + 10 * 60_000);
    const pool = agent.get(DB);
    pool.intercept({ path: (p) => p.includes(`/plan/${EVA}/`), method: "GET" }).reply(200, planXml(at)).persist();
    pool.intercept({ path: (p) => p.includes(`/fchg/${EVA}`), method: "GET" }).reply(200, `<timetable station="Teststadt Hbf" eva="${EVA}"/>`).persist();
    const trains = new DbTimetablesClient({ credentials: { baseUrl: `${DB}/timetables/v1`, clientId: "id", apiKey: "secret" }, fetch: (input, init) => fetch(input, init) });
    const { client, close } = await connect({ trains });
    const r = await client.callTool({ name: "get_train_departures", arguments: { eva_no: EVA, language: "en", duration_min: 30 } });
    expect(r.isError, textOf(r)).not.toBe(true);
    expect(textOf(r)).toContain("Teststadt Hbf");
    expect(textOf(r)).toContain("Weststadt");
    expect(textOf(r)).toContain("DB Timetables");
    expect(calls).toHaveLength(0);
    await close();
  });

  it("a 404 from DB names the EVA number", async () => {
    const pool = agent.get(DB);
    pool.intercept({ path: () => true, method: "GET" }).reply(404, "").persist();
    const trains = new DbTimetablesClient({ credentials: { baseUrl: `${DB}/timetables/v1`, clientId: "id", apiKey: "secret" }, fetch: (input, init) => fetch(input, init) });
    const { client, close } = await connect({ trains });
    const r = await client.callTool({ name: "get_train_departures", arguments: { eva_no: EVA, language: "en" } });
    expect(textOf(r)).toMatch(/EVA number 8000001|no departures/);
    await close();
  });
});

describe("the 60-per-minute limiter", () => {
  it("admits sixty starts in a minute and holds the sixty-first", async () => {
    let now = 0;
    const waits: number[] = [];
    const l = new RateLimiter({ minIntervalMs: 0, maxConcurrent: 100, perMinute: 60 }, () => now, async (ms) => {
      waits.push(ms);
      now += ms;
    });
    for (let i = 0; i < 60; i++) (await l.acquire())();
    expect(waits).toHaveLength(0);
    (await l.acquire())();
    expect(now).toBeGreaterThanOrEqual(61_000);
  });
});
