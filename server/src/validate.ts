/**
 * A call's arguments checked against its tool's inputSchema before any API read, answered as the
 * MCP SDK answers a zod tool schema it refuses: an isError result whose text is the protocol error
 * -32602, "Input validation error: Invalid arguments for tool <name>: <issue> at <path>", one issue
 * a line. The schema is the catalogue's own (the server's published contract), so a call the
 * catalogue refuses is refused here in the SDK's words, never forwarded for the API to word.
 *
 * One rewrite: a zod `datetime({ offset: true })` is published as format date-time AND its
 * pattern, and read back as two checks it would answer with two issues; the old server's one
 * check is the format, so the pattern zod emitted for it is dropped before the schema is read.
 */
import { z } from "zod";
import { getParseErrorMessage } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { ErrorCode, McpError, type CallToolResult, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { DATE_TIME_PATTERN } from "./catalogue.js";

function oneDateTimeCheck(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(oneDateTimeCheck);
  if (value === null || typeof value !== "object") return value;
  const o = value as Record<string, unknown>;
  const drop = o["format"] === "date-time" && o["pattern"] === DATE_TIME_PATTERN;
  return Object.fromEntries(Object.entries(o).filter(([k]) => !(drop && k === "pattern")).map(([k, v]) => [k, oneDateTimeCheck(v)]));
}

export type InputCheck = (name: string, args: Record<string, unknown>) => CallToolResult | null;

/** One validator per tool of the catalogue, built once; null means the arguments fit. */
export function inputCheck(tools: readonly Tool[]): InputCheck {
  const schemas = new Map(tools.map((t) => [t.name, z.fromJSONSchema(oneDateTimeCheck(t.inputSchema) as never)]));
  return (name, args) => {
    const parsed = schemas.get(name)?.safeParse(args);
    if (parsed === undefined || parsed.success) return null;
    const error = new McpError(ErrorCode.InvalidParams, `Input validation error: Invalid arguments for tool ${name}: ${getParseErrorMessage(parsed.error)}`);
    return { content: [{ type: "text", text: error.message }], isError: true };
  };
}
