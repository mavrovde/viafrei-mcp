/**
 * The MCP server around the handlers: what each resource reads and says, the watch resources of a session,
 * the unknown tool and the unknown resource, and a handler that fails: an API failure in words, anything else
 * one plain sentence. All answers from the API contract's v0.3.0 examples.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { HttpResponse } from "msw";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { calls, exampleOf, handlerFor, mockServer, problem } from "./api-mock.js";
import { connect, textOf } from "./harness.js";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  mockServer.resetHandlers();
  calls.length = 0;
});
afterAll(() => mockServer.close());

type Body = { data: unknown; meta: Record<string, unknown> };
const ex = <T>(op: string): T => exampleOf<Body>(op).data as T;

async function read(uri: string): Promise<{ uri: string; mimeType?: string; text: string }> {
  const { client, close } = await connect();
  try {
    return (await client.readResource({ uri })).contents[0] as { uri: string; mimeType?: string; text: string };
  } finally {
    await close();
  }
}
const query = (op: string) => calls.filter((c) => c.operationId === op).map((c) => Object.fromEntries(c.url.searchParams));

describe("resources", () => {
  it("viafrei://attribution: one line per source, its licence and where the licence is", async () => {
    const r = await read("viafrei://attribution");
    const rows = ex<{ family: string; attribution: string; licence: string; licenceUrl: string }[]>("listSources");
    expect(r.mimeType).toBe("text/plain");
    expect(r.uri).toBe("viafrei://attribution");
    expect(r.text).toBe(rows.map((s) => `${s.family}: ${s.attribution} (${s.licence}, ${s.licenceUrl})`).join("\n"));
    expect(r.text.split("\n")[0]).toBe("bkg_gvisys: Verwaltungseinheiten: © BKG (2026) dl-de/by-2-0, Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_gn250.pdf (Daten verändert) (dl-de/by-2-0, https://licences.example/dl-de-by-2-0)");
  });

  it("viafrei://coverage: the sources and the places coverage together", async () => {
    const r = await read("viafrei://coverage");
    expect(r.mimeType).toBe("application/json");
    expect(JSON.parse(r.text)).toEqual({ sources: ex("listSources"), places: ex("getPlacesCoverage") });
    expect(r.text).toBe(JSON.stringify(JSON.parse(r.text), null, 2));
  });

  it("viafrei://status/feeds, viafrei://gazetteer and viafrei://addresses", async () => {
    expect(JSON.parse((await read("viafrei://status/feeds")).text)).toEqual(ex("listSources"));
    const cov = ex<{ kinds: unknown; lands: unknown; addresses: unknown }>("getPlacesCoverage");
    expect(JSON.parse((await read("viafrei://gazetteer")).text)).toEqual({ kinds: cov.kinds, lands: cov.lands });
    expect(JSON.parse((await read("viafrei://addresses")).text)).toEqual(cov.addresses);
  });

  for (const [uri, topics] of [
    ["viafrei://rules/driving-in-germany", ["speed", "alcohol", "winter", "equipment", "toll", "truck_ban"]],
    ["viafrei://rules/low-emission-zones", ["lez"]],
    ["viafrei://emergency", ["emergency"]],
    ["viafrei://rules/electric-driving", ["ev"]],
  ] as const) {
    it(`${uri}: the rules of ${topics.join(", ")} as markdown`, async () => {
      const d = ex<{ rules: Record<string, unknown>[] }>("getDrivingRules");
      mockServer.use(handlerFor("getDrivingRules", (url) => HttpResponse.json({ ...exampleOf<Body>("getDrivingRules"), data: { ...d, title: `T ${url.searchParams.get("topic")}`, rules: [d.rules[0], { ...d.rules[1], legalBasis: null }] } })));
      const r = await read(uri);
      expect(r.mimeType).toBe("text/markdown");
      expect(query("getDrivingRules").map((q) => q["topic"])).toEqual(topics);
      const block = (t: string) => `## T ${t}\n- Synthetic statement 1 about winter_tyres, for tests only. (§ 0 synthetic)\n- Synthetic statement 2 about winter_tyres, for tests only.\n\n_Informational, not legal advice. (2026-11-17)_`;
      expect(r.text).toBe(topics.map(block).join("\n\n"));
    });
  }

  it("viafrei://place/<name>: up to five places for the decoded name", async () => {
    const r = await read("viafrei://place/K%C3%B6ln%20Hbf");
    expect(query("listPlaces")).toEqual([{ q: "Köln Hbf", limit: "5" }]);
    expect(JSON.parse(r.text)).toEqual(ex("listPlaces"));
  });

  it("a session's watches: the list, one watch read from the API, and a watch that is not there", async () => {
    const { client, close } = await connect();
    try {
      expect(JSON.parse(((await client.readResource({ uri: "viafrei://watches" })).contents[0] as { text: string }).text)).toEqual([]);
      await client.callTool({ name: "watch_situation", arguments: { kind: "road", key: "A103", language: "en" } });
      const w = ex<{ watchId: string; uri: string }>("getWatch");
      expect(JSON.parse(((await client.readResource({ uri: "viafrei://watches" })).contents[0] as { text: string }).text)).toEqual([{ id: 1, watchId: w.watchId, uri: w.uri, kind: "road", key: "A103" }]);
      calls.length = 0;
      const one = (await client.readResource({ uri: "viafrei://watch/1" })).contents[0] as { text: string };
      expect(query("getWatch")).toEqual([{ watch_id: w.watchId }]);
      expect(JSON.parse(one.text)).toEqual(ex("getWatch"));
      await expect(client.readResource({ uri: "viafrei://watch/2" })).rejects.toThrow("no watch 2 in this conversation");
      await expect(client.readResource({ uri: "viafrei://watch/x" })).rejects.toThrow("unknown resource viafrei://watch/x");
      await expect(client.readResource({ uri: "viafrei://nothing" })).rejects.toThrow("unknown resource viafrei://nothing");
      await expect(client.readResource({ uri: "xviafrei://watches" })).rejects.toThrow("unknown resource");
      await expect(client.readResource({ uri: "viafrei://place/" })).rejects.toThrow("unknown resource");
    } finally {
      await close();
    }
  });

  it("subscribing and unsubscribing are accepted", async () => {
    const { client, close } = await connect();
    try {
      expect(await client.subscribeResource({ uri: "viafrei://watches" })).toEqual({});
      expect(await client.unsubscribeResource({ uri: "viafrei://watches" })).toEqual({});
    } finally {
      await close();
    }
  });
});

describe("tool calls that go wrong", () => {
  async function call(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    const { client, close } = await connect();
    try {
      return (await client.callTool({ name, arguments: args })) as CallToolResult;
    } finally {
      await close();
    }
  }

  it("an unknown tool, in each language, asks the API nothing", async () => {
    for (const [language, text] of [["de", "Unbekanntes Werkzeug: no_such_tool"], ["en", "Unknown tool: no_such_tool"]]) {
      const r = await call("no_such_tool", { language });
      expect(r.isError).toBe(true);
      expect(textOf(r)).toBe(text);
    }
    expect(calls).toHaveLength(0);
  });

  it("no arguments at all: the schema's refusal, as today's server words it (parity run)", async () => {
    const { client, close } = await connect();
    try {
      const r = (await client.callTool({ name: "describe_location" })) as CallToolResult;
      expect(textOf(r)).toBe(
        "MCP error -32602: Input validation error: Invalid arguments for tool describe_location: Invalid input: expected number, received undefined at lat\nInvalid input: expected number, received undefined at lon",
      );
    } finally {
      await close();
    }
  });

  it("an API failure is worded for the person", async () => {
    mockServer.use(handlerFor("listAddresses", () => problem(400, "invalid-parameter", "q is too short")));
    const r = await call("find_address", { query: "xyz", language: "en" });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toBe("The request does not fit: q is too short");
  });

  it("anything else is one plain sentence, in each language", async () => {
    mockServer.use(handlerFor("listAddresses", () => HttpResponse.json({ data: { addresses: null }, meta: {} })));
    for (const [language, text] of [["de", "Bei dieser Anfrage ist ein Fehler aufgetreten."], ["en", "Something went wrong with this request."]]) {
      const r = await call("find_address", { query: "xyz", language });
      expect(r.isError).toBe(true);
      expect(textOf(r)).toBe(text);
    }
  });
});

describe("arguments the tool's schema refuses (as the SDK answers them, before any API read)", () => {
  const refuse = async (name: string, args: Record<string, unknown>): Promise<CallToolResult> => {
    const { client, close } = await connect();
    try {
      return (await client.callTool({ name, arguments: args })) as CallToolResult;
    } finally {
      await close();
    }
  };

  it("a missing required argument: -32602, its issue and path, and no API call", async () => {
    expect(await refuse("find_place", { kind: "junction", language: "de" })).toEqual({
      content: [{ type: "text", text: "MCP error -32602: Input validation error: Invalid arguments for tool find_place: Invalid input: expected string, received undefined at query" }],
      isError: true,
      _meta: { errorCode: "invalid_input" },
    });
    expect(calls).toHaveLength(0);
  });

  it("every issue on its own line, a nested path dotted", async () => {
    const r = await refuse("watch_situation", { kind: "road", key: "A2", hours: "two", condition: { events: [7] }, language: "en" });
    expect(r.isError).toBe(true);
    expect(textOf(r).split("\n")[0]).toMatch(/^MCP error -32602: Input validation error: Invalid arguments for tool watch_situation: .+ at /u);
    expect(textOf(r).split("\n").length).toBeGreaterThan(1);
    expect(calls).toHaveLength(0);
  });
});

describe("a date-time argument the schema refuses", () => {
  it("one issue, the format's, as today's server words it", async () => {
    const { client, close } = await connect();
    try {
      const r = (await client.callTool({ name: "get_train_departures", arguments: { language: "de", when: "soon", eva_no: "8001001" } })) as CallToolResult;
      expect(r).toEqual({ content: [{ type: "text", text: "MCP error -32602: Input validation error: Invalid arguments for tool get_train_departures: Invalid ISO datetime at when" }], isError: true, _meta: { errorCode: "invalid_input" } });
      const ok = (await client.callTool({ name: "get_train_departures", arguments: { language: "de", when: "2026-03-30T05:00:00+02:00", eva_no: "8001001" } })) as CallToolResult;
      expect(textOf(ok)).not.toMatch(/^MCP error -32602/u);
    } finally {
      await close();
    }
  });
});
