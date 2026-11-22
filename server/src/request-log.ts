/**
 * The fault line beside the info request line: one warn or error line per MCP request that went wrong,
 * so whoever runs the server can read WHICH tool or method and WHY, not only that the counters moved.
 *
 *   server_5xx           error  any request answered 5xx; keyed by the tool, else the method
 *   rpc_unknown_method   warn   -32601: a method this server does not have; keyed by the method
 *   tool_unknown         warn   a tools/call naming a tool not in the catalogue; keyed by the name
 *   tool_error           warn   a tool's own error result, with its closed-list code and reason
 *   rpc_error            warn   any other JSON-RPC error
 *
 * A request refused by the per-address limit (429) is not a fault: it is counted and logged as a request.
 * The fields are a closed list: never an argument, an address, a session id or the result's text. A key
 * the client chose (a method or tool name) passes through the log mask first.
 */
import type { RequestLogLine } from "./app.js";
import { clientKey } from "./log-mask.js";
import type { ToolErrorCode, ToolErrorReason } from "./usage-names.js";

export type FaultKind = "server_5xx" | "rpc_unknown_method" | "tool_unknown" | "tool_error" | "rpc_error";

export type RequestErrorLine = {
  readonly level: "warn" | "error";
  readonly fields: {
    readonly kind: FaultKind;
    readonly key: string | null;
    readonly status: number;
    readonly ms: number;
    readonly rpcErrorCode?: number;
    readonly code?: ToolErrorCode | "unclassified";
    readonly reason?: ToolErrorReason;
  };
  readonly message: string;
};

/** The key of a tools/call whose name is not shaped like a tool's. */
export const TOOL_UNSHAPED = "unshaped";

/** JSON-RPC's "method not found". */
export const METHOD_NOT_FOUND = -32601;

export function requestErrorLine(line: RequestLogLine, toolNames: ReadonlySet<string>): RequestErrorLine | null {
  const code = line.rpcErrorCode;
  const base = { status: line.status, ms: line.ms, ...(code === undefined ? {} : { rpcErrorCode: code }) };
  if (line.status >= 500) {
    return { level: "error", fields: { kind: "server_5xx", key: clientKey(line.tool ?? line.rpc ?? "-"), ...base }, message: "an MCP request was answered with a server error" };
  }
  if (line.limited !== undefined) return null;
  if (code === METHOD_NOT_FOUND) {
    return { level: "warn", fields: { kind: "rpc_unknown_method", key: clientKey(line.rpc ?? "-"), ...base }, message: "an MCP client asked for a method this server does not have" };
  }
  const errored = line.rpcError === true || code !== undefined;
  if (line.rpc === "tools/call" && (line.tool === null || !toolNames.has(line.tool)) && (errored || line.toolError === true)) {
    return { level: "warn", fields: { kind: "tool_unknown", key: line.tool === null ? TOOL_UNSHAPED : clientKey(line.tool), ...base }, message: "an MCP client called a tool this server does not have" };
  }
  if (line.toolError === true) {
    return {
      level: "warn",
      fields: { kind: "tool_error", key: clientKey(line.tool ?? "-"), ...base, code: line.toolErrorCode ?? "unclassified", ...(line.toolErrorReason === undefined ? {} : { reason: line.toolErrorReason }) },
      message: "a tool answered with an error result",
    };
  }
  if (errored) {
    return { level: "warn", fields: { kind: "rpc_error", key: clientKey(line.tool ?? line.rpc ?? "-"), ...base }, message: "an MCP request was answered with a JSON-RPC error" };
  }
  return null;
}
