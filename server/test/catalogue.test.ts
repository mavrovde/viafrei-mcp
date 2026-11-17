import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DATE_TIME_PATTERN, loadCatalogue, normaliseLikeCapture } from "../src/catalogue.js";
import { connect } from "./harness.js";

/** Sorted keys: the SDK client re-parses a result and reorders keys; the raw bytes are compared by the e2e run over HTTP. */
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x !== null && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

const published = JSON.parse(readFileSync(new URL("../../catalogue.json", import.meta.url), "utf8"));

describe("the catalogue is the published one, byte for byte (raw bytes in the e2e run)", () => {
  it("the server's copy equals the repository's catalogue.json", () => {
    expect(readFileSync(new URL("../catalogue/catalogue.json", import.meta.url), "utf8")).toBe(readFileSync(new URL("../../catalogue.json", import.meta.url), "utf8"));
  });

  it("restores the date-time pattern the capture stored as its length", () => {
    expect(DATE_TIME_PATTERN).toHaveLength(288);
  });

  it("tools/list, resources/list, templates and prompts/list equal catalogue.json under the capture's normalisation", async () => {
    const { client, close } = await connect();
    const tools = (await client.listTools()).tools;
    expect(canon(normaliseLikeCapture(tools))).toBe(canon(published.tools));
    expect(tools.every((t) => (t.inputSchema as { $schema?: string }).$schema === "http://json-schema.org/draft-07/schema#")).toBe(true);
    expect(canon((await client.listResources()).resources)).toBe(canon(published.resources));
    expect(canon((await client.listResourceTemplates()).resourceTemplates)).toBe(canon(published.resourceTemplates));
    expect(canon((await client.listPrompts()).prompts)).toBe(canon(published.prompts));
    expect(client.getInstructions()).toBe(published.instructions);
    expect(client.getServerVersion()).toEqual(published.serverInfo);
    await close();
  });

  it("loads every tool", () => {
    expect(loadCatalogue().tools).toHaveLength(published.tools.length);
  });
});
