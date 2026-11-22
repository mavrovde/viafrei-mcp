/**
 * Each case is today's server's answer to one call, copied from the parity run (fixtures/parity-golden.json),
 * and the API state that run had for it (STATE below). The answer here must be the same: text with the Stand
 * time masked, structuredContent without asOf, and _meta attribution and license.
 */
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { HttpResponse } from "msw";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { calls, exampleOf, handlerFor, mockServer } from "./api-mock.js";
import { connect, textOf } from "./harness.js";

type Case = { tool: string; args: Record<string, unknown>; isError: boolean; text: string; structuredContent: Record<string, unknown> | null; meta: Record<string, unknown> };
const golden = JSON.parse(readFileSync(new URL("./fixtures/parity-golden.json", import.meta.url), "utf8")) as { cases: Case[] };

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => { mockServer.resetHandlers(); calls.length = 0; });
afterAll(() => mockServer.close());

/** Answers `op` with its contract example, `data` replaced and the attribution cleared where given. */
function serve(op: string, data: unknown, meta: Record<string, unknown> = {}): void {
  mockServer.use(handlerFor(op, () => {
    const ex = exampleOf<{ data: unknown; meta: Record<string, unknown> }>(op);
    return HttpResponse.json({ data, meta: { ...ex.meta, ...meta } });
  }));
}

/** The API state of the parity run, per tool: what its reads answered. */
const STATE: Record<string, () => void> = {
  // The harness loads no OpenStreetMap addresses: the search finds none and the coverage lists no Land.
  find_address: () => {
    serve("listAddresses", { addresses: [] }, { attribution: [] });
    serve("getPlacesCoverage", { kinds: [], lands: [], addresses: [] });
  },
};

const masked = (r: CallToolResult) => {
  const sc = r.structuredContent === undefined ? null : Object.fromEntries(Object.entries(r.structuredContent).filter(([k]) => k !== "asOf"));
  const m = (r._meta ?? {}) as Record<string, unknown>;
  return { isError: r.isError === true, text: textOf(r).replace(/(Stand|As of) \d{2}:\d{2}/gu, "$1 HH:MM"), structuredContent: sc, meta: { attribution: m["attribution"], license: m["license"] } };
};

describe("today's answer, from the parity run", () => {
  for (const c of golden.cases) {
    it(`${c.tool} ${JSON.stringify(c.args)}`, async () => {
      const state = STATE[c.tool];
      if (state === undefined) throw new Error(`no API state for ${c.tool}`);
      state();
      const { client, close } = await connect({});
      try {
        const r = (await client.callTool({ name: c.tool, arguments: c.args })) as CallToolResult;
        expect(masked(r)).toEqual({ isError: c.isError, text: c.text, structuredContent: c.structuredContent, meta: c.meta });
      } finally {
        await close();
      }
    });
  }
});
