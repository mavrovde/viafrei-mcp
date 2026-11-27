/**
 * Every find_speed_cameras answer reads as text and holds the § 23 notice (mcp #291 B4): a client showed the
 * structuredContent's JSON, so the text itself is checked to be prose, in all four outcomes — a list, none
 * published, a refusal (no place, an unknown place) and the candidates of a shared town name.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { HttpResponse } from "msw";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { calls, exampleOf, handlerFor, mockServer } from "./api-mock.js";
import { connect, textOf } from "./harness.js";
import { SPEED_NOTICE_DE, speedNoticeEn } from "../src/tools/speed-cameras.js";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  calls.length = 0;
});
afterAll(() => mockServer.close());

type Lang = "de" | "en";
async function call(args: Record<string, unknown>): Promise<CallToolResult> {
  const { client, close } = await connect();
  try {
    return (await client.callTool({ name: "find_speed_cameras", arguments: args })) as CallToolResult;
  } finally {
    await close();
  }
}
const metaOf = (id: string, language: Lang) => ({
  ...exampleOf<{ meta: Record<string, unknown> }>(id).meta,
  notes: { purpose: [], condition: [language === "de" ? SPEED_NOTICE_DE : speedNoticeEn()] },
});
const place = (name: string, lat: number) => ({ id: `p-${lat}`, name, kind: "municipality", districtCode: null, sourceFamily: "geonames", location: { lat, lon: 9 } });
const camera = { ...exampleOf<{ data: { osm: Record<string, unknown>[] } }>("listSpeedCameras").data.osm[0], limitKmh: 50 };

/** The four outcomes; each sets the API's answers and gives the call's arguments. */
const OUTCOMES: Record<string, (language: Lang) => Record<string, unknown>> = {
  rows: (language) => {
    mockServer.use(handlerFor("listSpeedCameras", () => HttpResponse.json({ data: { official: [], officialTotal: 0, osm: [camera], osmTotal: 1 }, meta: metaOf("listSpeedCameras", language) })));
    return { lat: 52.03, lon: 8.53, language };
  },
  none: (language) => {
    mockServer.use(handlerFor("listSpeedCameras", () => HttpResponse.json({ data: { official: [], officialTotal: 0, osm: [], osmTotal: 0 }, meta: metaOf("listSpeedCameras", language) })));
    return { lat: 52.03, lon: 8.53, language };
  },
  "refusal: no place": (language) => ({ language }),
  "refusal: an unknown place": (language) => {
    mockServer.use(
      handlerFor("resolvePlace", () => HttpResponse.json({ data: null, meta: metaOf("listPlaces", language) })),
      handlerFor("listPlaces", () => HttpResponse.json({ data: [], meta: metaOf("listPlaces", language) })),
    );
    return { place: "Nirgendwo", language };
  },
  candidates: (language) => {
    mockServer.use(
      handlerFor("resolvePlace", () => HttpResponse.json({ data: null, meta: exampleOf<{ meta: Record<string, unknown> }>("listPlaces").meta })),
      handlerFor("listPlaces", () => HttpResponse.json({ data: [place("Neustadt", 50), place("Neustadt", 53)], meta: exampleOf<{ meta: Record<string, unknown> }>("listPlaces").meta })),
    );
    return { place: "Neustadt", language };
  },
};

describe("find_speed_cameras: text, never JSON, and the § 23 notice in every outcome (mcp #291 B4)", () => {
  for (const [outcome, setUp] of Object.entries(OUTCOMES)) {
    for (const language of ["de", "en"] as const) {
      it(`${outcome} (${language})`, async () => {
        const r = await call(setUp(language));
        const text = textOf(r);
        expect(r.content[0]?.type).toBe("text");
        expect(() => JSON.parse(text)).toThrow();
        expect(text.trimStart().startsWith("{")).toBe(false);
        expect(text).toContain(SPEED_NOTICE_DE);
        if (language === "en") expect(text).toContain(speedNoticeEn());
        if (outcome === "candidates") expect(r.structuredContent).toMatchObject({ ambiguous: true, planningOnly: true, noticeDe: SPEED_NOTICE_DE });
      });
    }
  }
});
