/**
 * The "tool call failed" line of a crash carries its message and the first frame of its stack, so a prod "internal"
 * answer can be traced to its line; an API failure keeps its kind and no message (its words may repeat the request's).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { HttpResponse } from "msw";
import { calls, exampleOf, handlerFor, mockServer } from "./api-mock.js";
import { connect, textOf } from "./harness.js";
import { ApiError } from "../src/api/client.js";
import { log } from "../src/log.js";
import { crashOf } from "../src/server.js";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  calls.length = 0;
  vi.restoreAllMocks();
});
afterAll(() => mockServer.close());

describe("the tool call failed line", () => {
  it("names a crash's message and its first frame, from the package's src/ on", async () => {
    const warns: { fields: Record<string, unknown>; message: string }[] = [];
    vi.spyOn(log, "warn").mockImplementation(((fields: Record<string, unknown>, message: string) => { warns.push({ fields, message }); }) as never);
    // A road status without its counts' families: the read throws a TypeError inside the handler.
    const ex = exampleOf("getMotorwayConditions");
    const broken = { windowEnd: "2026-11-28T05:35:11Z", counts: { closed: 0, restricted: 0, planned: 0, programme: 0, current: 0, total: 0 }, items: [], hidden: 0, hiddenClosures: 0, canRaise: false, sourcesAnswered: [], guidance: [], guidanceNotCurrent: [], plannedWorksHaveNoCoordinates: false };
    mockServer.use(handlerFor("getMotorwayConditions", () => HttpResponse.json({ ...ex, data: { ...(ex.data as object), roadStatus: broken } })));
    const { client, close } = await connect();
    try {
      const r = await client.callTool({ name: "check_road_status", arguments: { road: "A7", language: "en" } });
      expect(textOf(r)).toBe("Something went wrong with this request.");
    } finally {
      await close();
    }
    const failed = warns.find((w) => w.message === "tool call failed");
    expect(failed?.fields).toMatchObject({ tool: "check_road_status", error: "TypeError", kind: null });
    expect(failed?.fields["message"]).toMatch(/map/u);
    expect(failed?.fields["frame"]).toMatch(/^at .*\(src\/tools\/road-status-words\.ts:\d+:\d+\)$/u);
  });

  it("an API failure keeps its kind, never its message; a thrown non-error has neither", () => {
    expect(crashOf(new ApiError("invalid", "resolvePlace: q Hauptstraße 1 is too short"))).toEqual({});
    expect(crashOf("text")).toEqual({});
    const e = new RangeError("Invalid time value");
    e.stack = "RangeError: Invalid time value\n    at Date.toISOString (<anonymous>)\n    at f (file:///opt/app/dist/tools/x.js:3:9)";
    expect(crashOf(e)).toEqual({ message: "Invalid time value", frame: "at Date.toISOString (<anonymous>)" });
    e.stack = "RangeError: x\n    at file:///opt/app/dist/tools/x.js:3:9";
    expect(crashOf(e).frame).toBe("at dist/tools/x.js:3:9");
    e.stack = "RangeError: no frame";
    expect(crashOf(e)).toEqual({ message: "Invalid time value" });
  });
});
