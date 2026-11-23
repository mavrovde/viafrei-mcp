/**
 * The usage counters' vocabulary, carried from the server this one replaces: how a client name becomes a key,
 * how a latency becomes a bucket, and which outcome a request counts as. The counts themselves leave as one
 * structured log line per bucket (`usage.ts`); this server has no database to write them to.
 */
export const MCP_USAGE_BUCKETS_MS = [100, 250, 500, 1_000, 2_500, 5_000, 10_000] as const;

export const MCP_USAGE_BUCKET_COLUMNS: readonly string[] = [
  ...MCP_USAGE_BUCKETS_MS.map((b) => `ms_le_${String(b)}`),
  `ms_gt_${String(MCP_USAGE_BUCKETS_MS[MCP_USAGE_BUCKETS_MS.length - 1])}`,
];

export type UsageErrorClass = "refusal" | "tool" | "server";

export function usageErrorClass(status: number, rpcError = false, toolError = false): UsageErrorClass | null {
  if (status >= 500) return "server";
  if (status >= 400) return "refusal";
  return rpcError || toolError ? "tool" : null;
}

export const MCP_TOOL_ERROR_CODES = ["invalid_input", "not_found", "out_of_coverage", "unavailable", "limit_reached", "timeout", "internal"] as const;

export type McpToolErrorCode = (typeof MCP_TOOL_ERROR_CODES)[number];

export function isMcpToolErrorCode(v: unknown): v is McpToolErrorCode {
  return typeof v === "string" && (MCP_TOOL_ERROR_CODES as readonly string[]).includes(v);
}

export const MCP_USAGE_CLIENT_MAX = 40;

export const MCP_USAGE_CLIENT_UNKNOWN = "unknown";

export const MCP_USAGE_CLIENT_OTHER = "other";

export const MCP_USAGE_CLIENT_STATELESS = "stateless";

export const MCP_USAGE_CLIENT_OWN_OTHER = "viafrei-own";

export const MCP_USAGE_CLIENTS: Readonly<Record<string, string>> = {
  "claude-ai": "claude-ai",
  "claude-desktop": "claude-desktop",
  "claude-code": "claude-code",
  cursor: "cursor",
  "visual-studio-code": "vscode",
  vscode: "vscode",
  "github-copilot": "github-copilot",
  windsurf: "windsurf",
  codeium: "windsurf",
  cline: "cline",
  "roo-code": "roo-code",
  continue: "continue",
  zed: "zed",
  goose: "goose",
  "mcp-inspector": "mcp-inspector",
  "inspector-client": "mcp-inspector",
  "openai-mcp": "openai",
  chatgpt: "openai",
  codex: "codex",
  "gemini-cli": "gemini-cli",
  "mcp-remote": "mcp-remote",
  smithery: "smithery",
  glama: "glama",
  n8n: "n8n",
  librechat: "librechat",
  "lm-studio": "lm-studio",
  lmstudio: "lm-studio",
  raycast: "raycast",
  jetbrains: "jetbrains",
  warp: "warp",
  "amazon-q": "amazon-q",
  postman: "postman",
  "viafrei-smoke": "viafrei-smoke",
  "release-probe": "release-probe",
  "viafrei-status-probe": "viafrei-status-probe",
  "deploy-probe": "deploy-probe",
  "prod-round": "prod-round",
  "viafrei-soak": "viafrei-soak",
  "viafrei-test-round": "viafrei-test-round",
  // Any OTHER `viafrei-*` name — a new runner, a lead's session that sends
  // the prefix — is ours too. The shortest key, so every listed name above wins.
  viafrei: MCP_USAGE_CLIENT_OWN_OTHER,
};

const CLIENT_KEYS = Object.keys(MCP_USAGE_CLIENTS).sort((a, b) => b.length - a.length);

export function bucketIndex(ms: number): number {
  const i = MCP_USAGE_BUCKETS_MS.findIndex((b) => ms <= b);
  return i === -1 ? MCP_USAGE_BUCKETS_MS.length : i;
}

export function normaliseClientName(raw: unknown): string {
  if (typeof raw !== "string") return MCP_USAGE_CLIENT_UNKNOWN;
  const slug = raw
    .slice(0, 256)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug === "") return MCP_USAGE_CLIENT_UNKNOWN;
  const key = CLIENT_KEYS.find((k) => slug === k || slug.startsWith(`${k}-`));
  return key === undefined ? MCP_USAGE_CLIENT_OTHER : (MCP_USAGE_CLIENTS[key] ?? MCP_USAGE_CLIENT_OTHER);
}

/** Which argument clause refused a call: a closed list, so the request log never carries an argument. */
export const TOOL_ERROR_REASONS = ["place_missing", "place_and_coords", "half_coordinate", "road_not_point", "two_ways_in"] as const;
export type ToolErrorReason = (typeof TOOL_ERROR_REASONS)[number];
export type ToolErrorCode = McpToolErrorCode;

function errorMeta(result: unknown, key: "errorCode" | "errorReason"): unknown {
  if (typeof result !== "object" || result === null || (result as { isError?: unknown }).isError !== true) return undefined;
  const meta = (result as { _meta?: unknown })._meta;
  return typeof meta === "object" && meta !== null ? (meta as Record<string, unknown>)[key] : undefined;
}

/** The code an error result carries in `_meta.errorCode`, or null for a success or a code off the list. */
export function toolErrorCodeOf(result: unknown): ToolErrorCode | null {
  const code = errorMeta(result, "errorCode");
  return isMcpToolErrorCode(code) ? code : null;
}

/** The clause an error result names in `_meta.errorReason`, or null. */
export function toolErrorReasonOf(result: unknown): ToolErrorReason | null {
  const reason = errorMeta(result, "errorReason");
  return typeof reason === "string" && (TOOL_ERROR_REASONS as readonly string[]).includes(reason) ? (reason as ToolErrorReason) : null;
}
