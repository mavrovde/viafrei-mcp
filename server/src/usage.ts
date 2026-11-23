/**
 * The usage counters: request events in, one structured log line per bucket out, once a minute.
 *
 * Carried from the server this one replaces, which wrote the same buckets to a table. This server reads the
 * ViaFrei API and has no database, so a bucket leaves as one `mcp usage` log line instead, its fields the
 * table's columns; the log collector keeps it.
 *
 * **A request never waits for it.** `record()` is synchronous and touches an in-memory map: no I/O, no promise,
 * and it never throws. A timer flushes the map every `flushMs`. A failed write puts its rows back, adding to
 * whatever arrived meanwhile, logs one warning naming how many rows wait, and the next tick tries again.
 *
 * **What it bounds, because every key part came from an unauthenticated body:**
 *   * `rpc`: a closed list of MCP methods; anything else is `other`, an unparseable body `invalid`;
 *   * `tool`: a REGISTERED tool name for `tools/call`, else `other`; '' for every other method;
 *   * `client`: normalised by `normaliseClientName` and capped at `maxClientsPerHour` distinct names per hour;
 *     past the cap a new name is `other`. A request answered without a session (the bare `tools/list`) arrives
 *     as `stateless`, set by the route table and unreachable from a sent name;
 *   * the buffer: at most `maxKeys` distinct rows. A new key past that is counted as dropped, and the count is
 *     logged at the next flush.
 *
 * **What it never sees:** the address, the session id, the arguments. The event type below is the whole input.
 */
import { bucketIndex, MCP_TOOL_ERROR_CODES, MCP_USAGE_BUCKET_COLUMNS, MCP_USAGE_CLIENT_OTHER, MCP_USAGE_CLIENT_STATELESS, MCP_USAGE_CLIENT_UNKNOWN, usageErrorClass, type McpToolErrorCode } from "./usage-names.js";

/** One bucket: an hour, a door, a method, a tool and a client, with its counts. */
export type UsageRow = {
  readonly periodStart: Date;
  readonly door: "streamable" | "sse";
  readonly rpc: string;
  readonly tool: string;
  readonly client: string;
  readonly requests: number;
  readonly errors: number;
  readonly refusals: number;
  readonly toolErrors: number;
  readonly serverErrors: number;
  readonly sessions: number;
  readonly totalMs: number;
  /** Counts per latency bucket, in `MCP_USAGE_BUCKET_COLUMNS` order. */
  readonly buckets: readonly number[];
  /** Counts per tool error code, in `MCP_TOOL_ERROR_CODES` order. */
  readonly toolErrorCodes: readonly number[];
};

/** The one log line a bucket becomes: its key and its counts, each latency bucket and error code by name. */
export function usageLogFields(r: UsageRow): Record<string, string | number> {
  const f: Record<string, string | number> = { period: "hour", periodStart: r.periodStart.toISOString(), door: r.door, rpc: r.rpc, tool: r.tool, client: r.client, requests: r.requests, errors: r.errors, refusals: r.refusals, toolErrors: r.toolErrors, serverErrors: r.serverErrors, sessions: r.sessions, totalMs: r.totalMs };
  MCP_USAGE_BUCKET_COLUMNS.forEach((c, k) => { f[c] = r.buckets[k] ?? 0; });
  MCP_TOOL_ERROR_CODES.forEach((c, k) => { f[`tool_error_${c}`] = r.toolErrorCodes[k] ?? 0; });
  return f;
}

/** One answered request, as the route table sees it. Nothing else reaches the ledger. */
/** What a failed write is logged as: its message, never a stack. */
const describeError = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export type UsageEvent = {
  readonly door: "streamable" | "sse";
  /** The JSON-RPC method as `rpcSummary` shaped it, or null. */
  readonly rpc: string | null;
  /** The tool name as `rpcSummary` shaped it, or null. */
  readonly tool: string | null;
  /** Already normalised (`normaliseClientName`). */
  readonly client: string;
  readonly status: number;
  /** The delivered answer was a JSON-RPC error object. */
  readonly rpcError?: boolean;
  /** The delivered answer was a result carrying `isError: true`. */
  readonly toolError?: boolean;
  /** That result's reason code, off the closed list; counted in its own column. Never the message. */
  readonly toolErrorCode?: McpToolErrorCode;
  readonly ms: number;
};

/**
 * The MCP methods counted by name (protocol revisions 2024-11-05 to 2025-06-18).
 * A method outside the list is `other`: a client cannot mint rows by inventing
 * method names.
 */
export const USAGE_RPCS: ReadonlySet<string> = new Set([
  "batch",
  "initialize",
  "ping",
  "tools/list",
  "tools/call",
  "resources/list",
  "resources/read",
  "resources/templates/list",
  "resources/subscribe",
  "resources/unsubscribe",
  "prompts/list",
  "prompts/get",
  "completion/complete",
  "logging/setLevel",
  "notifications/initialized",
  "notifications/cancelled",
  "notifications/progress",
  "notifications/roots/list_changed",
]);

export const USAGE_RPC_OTHER = "other";
export const USAGE_RPC_INVALID = "invalid";

/** Flush cadence: the issue's "about every minute". */
export const USAGE_FLUSH_MS = 60_000;
/** Distinct client names per hour before new ones become `other`. */
export const USAGE_MAX_CLIENTS_PER_HOUR = 32;
/** Distinct buffered rows before new keys are counted as dropped. */
export const USAGE_MAX_KEYS = 20_000;
/** The longest a flush may take before it counts as failed; its rows then go back into the buffer and a warning is logged. */
export const USAGE_FLUSH_DEADLINE_MS = 10_000;

export type UsageLedgerOptions = {
  /** Where a flush's rows go: one log line each. A rejection is a failed flush. */
  readonly write: (rows: readonly UsageRow[]) => Promise<void>;
  /** Registered tool names; any other `tools/call` name is `other`. */
  readonly tools: ReadonlySet<string>;
  readonly flushMs?: number;
  /** See `USAGE_FLUSH_DEADLINE_MS`. */
  readonly flushDeadlineMs?: number;
  readonly maxClientsPerHour?: number;
  readonly maxKeys?: number;
  readonly now?: () => number;
  readonly warn?: (fields: Record<string, unknown>, message: string) => void;
};

export type UsageLedger = {
  /** Synchronous, O(1), never throws. */
  readonly record: (e: UsageEvent) => void;
  /** Write what is buffered. True when it was written (or nothing waited). */
  readonly flush: () => Promise<boolean>;
  /** Arm the timer (unref'd). */
  readonly start: () => void;
  /** Disarm the timer and make one last flush attempt. */
  readonly stop: () => Promise<boolean>;
  /** Buffered rows not yet written. */
  readonly pending: () => number;
  /** Events refused because the buffer was full, since the last successful flush. */
  readonly dropped: () => number;
};

type Mutable = { periodStart: Date; door: UsageRow["door"]; rpc: string; tool: string; client: string; requests: number; errors: number; refusals: number; toolErrors: number; serverErrors: number; sessions: number; totalMs: number; buckets: number[]; toolErrorCodes: number[] };

const HOUR_MS = 3_600_000;

export function createUsageLedger(o: UsageLedgerOptions): UsageLedger {
  const now = o.now ?? Date.now;
  const flushMs = o.flushMs ?? USAGE_FLUSH_MS;
  const deadlineMs = o.flushDeadlineMs ?? USAGE_FLUSH_DEADLINE_MS;
  const maxClients = o.maxClientsPerHour ?? USAGE_MAX_CLIENTS_PER_HOUR;
  const maxKeys = o.maxKeys ?? USAGE_MAX_KEYS;
  let buffer = new Map<string, Mutable>();
  /** Client names admitted per hour (epoch ms of the hour → names). */
  const clientsByHour = new Map<number, Set<string>>();
  let dropped = 0;
  /** Keys of the batch a flush is writing: they still count against `maxKeys`. */
  let held = 0;
  let inflight: Promise<boolean> | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  const admitClient = (hour: number, client: string): string => {
    // The three markers are not client names and take no slot of the cap.
    if (client === MCP_USAGE_CLIENT_UNKNOWN || client === MCP_USAGE_CLIENT_OTHER || client === MCP_USAGE_CLIENT_STATELESS) return client;
    let seen = clientsByHour.get(hour);
    if (seen === undefined) {
      // A new hour: forget every hour but the previous one (a flush may still
      // carry its rows, and a late event may still land in it).
      for (const h of clientsByHour.keys()) if (h < hour - HOUR_MS) clientsByHour.delete(h);
      seen = new Set();
      clientsByHour.set(hour, seen);
    }
    if (seen.has(client)) return client;
    if (seen.size >= maxClients) return MCP_USAGE_CLIENT_OTHER;
    seen.add(client);
    return client;
  };

  const add = (target: Map<string, Mutable>, row: Mutable, force: boolean): boolean => {
    const key = `${String(row.periodStart.getTime())}|${row.door}|${row.rpc}|${row.tool}|${row.client}`;
    const have = target.get(key);
    if (have === undefined) {
      if (!force && target.size + held >= maxKeys) return false;
      target.set(key, { ...row, buckets: [...row.buckets], toolErrorCodes: [...row.toolErrorCodes] });
      return true;
    }
    have.requests += row.requests;
    have.errors += row.errors;
    have.refusals += row.refusals;
    have.toolErrors += row.toolErrors;
    have.serverErrors += row.serverErrors;
    have.sessions += row.sessions;
    have.totalMs += row.totalMs;
    for (let i = 0; i < have.buckets.length; i += 1) have.buckets[i] = (have.buckets[i] ?? 0) + (row.buckets[i] ?? 0);
    for (let i = 0; i < have.toolErrorCodes.length; i += 1) have.toolErrorCodes[i] = (have.toolErrorCodes[i] ?? 0) + (row.toolErrorCodes[i] ?? 0);
    return true;
  };

  const record = (e: UsageEvent): void => {
    try {
      const t = now();
      const hour = Math.floor(t / HOUR_MS) * HOUR_MS;
      const rpc = e.rpc === null ? USAGE_RPC_INVALID : USAGE_RPCS.has(e.rpc) ? e.rpc : USAGE_RPC_OTHER;
      const tool = rpc !== "tools/call" ? "" : e.tool !== null && o.tools.has(e.tool) ? e.tool : USAGE_RPC_OTHER;
      // One class per answer, and `errors` is their sum: a refusal
      // (4xx), a tool error (a delivered `isError` or JSON-RPC error) or a
      // server error (5xx).
      const cls = usageErrorClass(e.status, e.rpcError === true, e.toolError === true);
      const error = cls !== null;
      const ms = Number.isFinite(e.ms) && e.ms > 0 ? Math.round(e.ms) : 0;
      const buckets = MCP_USAGE_BUCKET_COLUMNS.map(() => 0);
      buckets[bucketIndex(ms)] = 1;
      // a delivered `isError` result is counted under its reason too; a
      // JSON-RPC error carries none, and a code off the list is not counted.
      const toolErrorCodes = MCP_TOOL_ERROR_CODES.map(() => 0);
      const codeAt = cls === "tool" && e.toolError === true && e.toolErrorCode !== undefined ? MCP_TOOL_ERROR_CODES.indexOf(e.toolErrorCode) : -1;
      if (codeAt >= 0) toolErrorCodes[codeAt] = 1;
      const row: Mutable = {
        periodStart: new Date(hour),
        door: e.door,
        rpc,
        tool,
        client: admitClient(hour, e.client),
        requests: 1,
        errors: error ? 1 : 0,
        refusals: cls === "refusal" ? 1 : 0,
        toolErrors: cls === "tool" ? 1 : 0,
        serverErrors: cls === "server" ? 1 : 0,
        sessions: rpc === "initialize" && !error ? 1 : 0,
        totalMs: ms,
        buckets,
        toolErrorCodes,
      };
      if (!add(buffer, row, false)) dropped += 1;
    } catch {
      // A counter never fails a request.
    }
  };

  const doFlush = async (): Promise<boolean> => {
    if (buffer.size === 0) return true;
    const batch = buffer;
    buffer = new Map();
    const rows = [...batch.values()];
    held = batch.size;
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { reject(new Error(`the flush did not finish within ${String(deadlineMs)} ms`)); }, deadlineMs);
        timer.unref();
      });
      try {
        const write = o.write(rows);
        // A write that loses the race and fails later must not be an unhandled rejection.
        write.catch(() => undefined);
        await Promise.race([write, deadline]);
      } finally {
        clearTimeout(timer);
      }
      held = 0;
      if (dropped > 0) {
        o.warn?.({ dropped }, "mcp usage: events were not counted because the buffer was full while the counts could not be written");
        dropped = 0;
      }
      return true;
    } catch (err) {
      held = 0;
      // Back into the buffer, ADDED to what arrived meanwhile: the next tick
      // writes the sum. Forced past `maxKeys`, because these rows were already
      // counted once and refusing them now would be the silent drop. The union
      // stays within `maxKeys`, because new keys were admitted only up to
      // `maxKeys` minus this batch while it was being written.
      for (const r of rows) add(buffer, r, true);
      o.warn?.({ err: describeError(err), rows: rows.length, pending: buffer.size, dropped }, "mcp usage: flush failed; the counts are kept and retried at the next flush");
      return false;
    }
  };

  const flush = (): Promise<boolean> => {
    // One flush at a time: a slow write must not stack flushes up.
    if (inflight !== null) return Promise.resolve(false);
    inflight = doFlush().finally(() => { inflight = null; });
    return inflight;
  };

  return {
    record,
    flush,
    start: () => {
      if (timer !== undefined || flushMs <= 0) return;
      timer = setInterval(() => { void flush(); }, flushMs);
      timer.unref();
    },
    stop: async () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
      if (inflight !== null) await inflight;
      return flush();
    },
    pending: () => buffer.size,
    dropped: () => dropped,
  };
}
