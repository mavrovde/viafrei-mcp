/**
 * The tool, resource, template and prompt catalogue the server announces. It is the published contract
 * (`catalogue/catalogue.json`, the same snapshot the bridge ships), served as captured, with the two
 * substitutions its `$comment` documents undone: every tool's inputSchema gets its draft-07 `$schema`
 * back, and a `patternLength` is the ISO-8601 date-time pattern again (zod's, the text the server's
 * schema produced). Names, descriptions and schemas are therefore the server's own, byte for byte.
 */
import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Prompt, Resource, ResourceTemplate, Tool } from "@modelcontextprotocol/sdk/types.js";

export type Catalogue = {
  protocolVersion: string;
  serverInfo: { name: string; version: string; title?: string; description?: string };
  capabilities: Record<string, unknown>;
  instructions: string;
  tools: Tool[];
  resources: Resource[];
  resourceTemplates: ResourceTemplate[];
  prompts: Prompt[];
};

export const DRAFT_07 = "http://json-schema.org/draft-07/schema#";

/** The date-time pattern a zod `datetime({ offset: true })` emits: 288 characters. */
export const DATE_TIME_PATTERN: string = (z.toJSONSchema(z.string().datetime({ offset: true }), { target: "draft-7" }) as { pattern: string }).pattern;

function restore(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(restore);
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === "patternLength" && v === DATE_TIME_PATTERN.length) out["pattern"] = DATE_TIME_PATTERN;
    else out[k] = restore(v);
  }
  return out;
}

/** The capture's own normalisation (the bridge's probe): drop `$schema`, a long pattern becomes its length. */
export function normaliseLikeCapture(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normaliseLikeCapture);
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === "$schema") continue;
    if (k === "pattern" && typeof v === "string" && v.length > 120) out["patternLength"] = v.length;
    else out[k] = normaliseLikeCapture(v);
  }
  return out;
}

export function loadCatalogue(file: URL = new URL("../catalogue/catalogue.json", import.meta.url)): Catalogue {
  const raw = JSON.parse(readFileSync(file, "utf8")) as Catalogue & { $comment?: string };
  return {
    protocolVersion: raw.protocolVersion,
    serverInfo: raw.serverInfo,
    capabilities: raw.capabilities,
    instructions: raw.instructions,
    tools: raw.tools.map((t) => {
      const schema = restore(t.inputSchema) as Record<string, unknown>;
      return { ...t, inputSchema: { $schema: DRAFT_07, ...schema } as unknown as Tool["inputSchema"] };
    }),
    resources: raw.resources,
    resourceTemplates: raw.resourceTemplates,
    prompts: raw.prompts,
  };
}
