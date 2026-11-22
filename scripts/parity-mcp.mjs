#!/usr/bin/env node
/**
 * Parity runner: asks two MCP servers the same tool calls and tells, tool by tool and
 * language by language, where their answers differ.
 *
 *   node scripts/parity-mcp.mjs --old '<command>' --new '<command>' --calls <calls.json>
 *        [--langs de,en] [--stub-log <file>] [--out <table.md>] [--jobs 4]
 *        [--budget-s 600] [--call-timeout-s 30]
 *
 * Both servers are started over stdio from their commands (run by /bin/sh, with this
 * process's environment), side by side, and every call goes to both at once.
 * `calls.json` is a list of `{ "tool": "<name>", "args": { … }, "kind": "golden"|"error" }`;
 * each call is asked once per language, with `language` set to it.
 *
 * What is compared, per call: isError, the content text, structuredContent, and the
 * `_meta` members attribution, license, purposeNote, conditionNote and shareAlike.
 * Normalised: only `asOf` and `requestId` (left out wherever they stand) and the order
 * of an object's keys. Nothing relative to now is rewritten: a pair that differs in a
 * time, an age or a minute count is a difference, marked `clock?` in the first-diff
 * column so a reader can tell it from a real one.
 *
 * A pair is one of: identical; order only (equal once every array and the text's lines
 * are sorted); numeric only (equal once every number is blanked); differing. A call
 * missing on one side (the tool not listed, a protocol error, a time-out) is differing.
 * The old answer is also judged on its own: empty (an error, or every top-level list
 * empty) and stale (a `stale: true`, a stale freshness, an `answered: false`).
 *
 * Exit: 0 every pair identical; 1 a pair is not identical; 2 the run proves nothing:
 * the provider stub logged a request it does not know (`--stub-log` not empty), a tool
 * has no old answer that is neither empty nor stale (the seed does not reach it), a
 * server does not start, or the budget ran out.
 */
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const DROPPED = new Set(["asOf", "requestId"]);
const META_KEYS = ["attribution", "license", "purposeNote", "conditionNote", "shareAlike"];

/** The value with asOf/requestId left out at every depth and object keys sorted. */
export function normalise(v) {
  if (Array.isArray(v)) return v.map(normalise);
  if (v !== null && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) if (!DROPPED.has(k)) out[k] = normalise(v[k]);
    return out;
  }
  return v;
}

const canon = (v) => JSON.stringify(v ?? null);

/** What a tool result is compared on. `null` result = the call did not answer. */
export function viewOf(result) {
  const content = Array.isArray(result?.content) ? result.content : [];
  const meta = result?._meta ?? {};
  const pick = {};
  for (const k of META_KEYS) if (k in meta) pick[k] = meta[k];
  return {
    isError: result?.isError === true,
    text: content.filter((c) => c?.type === "text").map((c) => c.text).join("\n"),
    structuredContent: normalise(result?.structuredContent ?? null),
    meta: normalise(pick),
  };
}

const sortDeep = (v) => {
  if (Array.isArray(v)) return v.map(sortDeep).map(canon).sort().map((s) => JSON.parse(s));
  if (v !== null && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sortDeep(x)]));
  return v;
};
const NUM = /-?\d+(?:[.,]\d+)?/gu;
const blankDeep = (v) => {
  if (typeof v === "number") return "#";
  if (typeof v === "string") return v.replace(NUM, "#");
  if (Array.isArray(v)) return v.map(blankDeep);
  if (v !== null && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blankDeep(x)]));
  return v;
};
const lines = (t) => t.split("\n");

/** The first place two views differ: { path, old, new }. */
export function firstDiff(a, b, path = "") {
  if (canon(a) === canon(b)) return null;
  if (typeof a === "string" && typeof b === "string" && path === "text") {
    const la = lines(a), lb = lines(b);
    for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) return { path: `text line ${i + 1}`, old: la[i] ?? "(none)", new: lb[i] ?? "(none)" };
  }
  const bothObj = a !== null && b !== null && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b);
  if (bothObj) {
    const keys = Array.isArray(a) ? [...Array(Math.max(a.length, b.length)).keys()] : [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of keys) {
      const sub = Array.isArray(a) ? `${path}[${k}]` : path === "" ? String(k) : `${path}.${k}`;
      if (Array.isArray(a) ? k >= a.length : !(k in a)) return { path: sub, old: "(absent)", new: b[k] };
      if (Array.isArray(b) ? k >= b.length : !(k in b)) return { path: sub, old: a[k], new: "(absent)" };
      const d = firstDiff(a[k], b[k], sub);
      if (d) return d;
    }
  }
  return { path: path || "(answer)", old: a, new: b };
}

const TIMEISH = /\b\d{4}-\d\d-\d\dT\d\d:\d\d|\b\d{1,2}:\d\d\b|\bvor \d+ ?Min|\b\d+ ?min(?:utes?)? ago\b|\b\d+ ?Min\.?\b/iu;
const TIME_PATH = /(?:At|age|Age|Min|_min|minutes|Minutes|since|Since|time|Time|delay|Delay)\]?$/u;
/** A difference that a clock between the two calls of a pair could explain. */
export function clockish(d) {
  if (d === null) return false;
  const s = (v) => (typeof v === "string" ? v : canon(v));
  if (TIME_PATH.test(d.path)) return true;
  return TIMEISH.test(s(d.old)) && TIMEISH.test(s(d.new));
}

/** identical | order only | numeric only | differing, and the first diff. */
export function classify(oldView, newView) {
  if (oldView === null || newView === null) return { verdict: "differing", diff: { path: "(call)", old: oldView === null ? "(missing)" : "(answered)", new: newView === null ? "(missing)" : "(answered)" } };
  if (canon(oldView) === canon(newView)) return { verdict: "identical", diff: null };
  const diff = firstDiff(oldView, newView);
  const sorted = (v) => ({ ...v, text: lines(v.text).sort().join("\n"), structuredContent: sortDeep(v.structuredContent), meta: sortDeep(v.meta) });
  if (canon(sorted(oldView)) === canon(sorted(newView))) return { verdict: "order only", diff };
  if (canon(blankDeep(oldView)) === canon(blankDeep(newView))) return { verdict: "numeric only", diff };
  return { verdict: "differing", diff };
}

const findDeep = (v, pred) => {
  if (Array.isArray(v)) return v.some((x) => findDeep(x, pred));
  if (v !== null && typeof v === "object") return Object.entries(v).some(([k, x]) => pred(k, x) || findDeep(x, pred));
  return false;
};
/** The old answer on its own: empty, stale, or a usable answer. */
export function judgeOld(view) {
  if (view === null || view.isError) return { empty: true, stale: false };
  const sc = view.structuredContent;
  const lists = sc !== null && typeof sc === "object" && !Array.isArray(sc) ? Object.values(sc).filter(Array.isArray) : [];
  const empty = lists.length > 0 && lists.every((l) => l.length === 0);
  const stale = findDeep(sc, (k, x) => (k === "stale" && x === true) || (k === "freshness" && (x === "stale" || x === "outdated")) || (k === "answered" && x === false));
  return { empty, stale };
}

const short = (v) => {
  const s = typeof v === "string" ? v : canon(v);
  return s.length > 70 ? `${s.slice(0, 67)}...` : s;
};
const cell = (s) => String(s).replaceAll("|", "\\|").replaceAll("\n", " ");

/** The table, from the judged pairs. */
export function tableOf(rows) {
  const by = new Map();
  for (const r of rows) {
    const key = `${r.tool}\u0000${r.lang}`;
    if (!by.has(key)) by.set(key, { tool: r.tool, lang: r.lang, calls: 0, identical: 0, "order only": 0, "numeric only": 0, differing: 0, empty: 0, stale: 0, first: "" });
    const t = by.get(key);
    t.calls++;
    t[r.verdict]++;
    if (r.old.empty) t.empty++;
    if (r.old.stale) t.stale++;
    if (t.first === "" && r.verdict !== "identical" && r.diff) t.first = `${clockish(r.diff) ? "clock? " : ""}${r.diff.path}: ${short(r.diff.old)} → ${short(r.diff.new)}`;
  }
  const out = ["| tool | lang | calls | identical | order only | numeric only | differing | empty | stale | first diff |", "|-|-|-|-|-|-|-|-|-|-|"];
  for (const t of [...by.values()].sort((a, b) => (a.tool === b.tool ? a.lang.localeCompare(b.lang) : a.tool.localeCompare(b.tool)))) {
    out.push(`| ${t.tool} | ${t.lang} | ${t.calls} | ${t.identical} | ${t["order only"]} | ${t["numeric only"]} | ${t.differing} | ${t.empty} | ${t.stale} | ${cell(t.first)} |`);
  }
  return out.join("\n");
}

/** Tools without a single old answer that is neither empty nor stale. */
export function seedGaps(rows) {
  const ok = new Map();
  for (const r of rows) ok.set(r.tool, (ok.get(r.tool) ?? false) || (!r.old.empty && !r.old.stale));
  return [...ok].filter(([, v]) => !v).map(([k]) => k).sort();
}

/** Unknown requests the provider stub logged: one per non-empty line. */
export function stubUnknown(path) {
  if (path === undefined || !existsSync(path) || statSync(path).size === 0) return [];
  return readFileSync(path, "utf8").split("\n").filter((l) => l.trim() !== "");
}

function parseArgs(argv) {
  const o = { langs: "de,en", jobs: "4", "budget-s": "600", "call-timeout-s": "30" };
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!k?.startsWith("--") || argv[i + 1] === undefined) return null;
    o[k.slice(2)] = argv[i + 1];
  }
  return o.old && o.new && o.calls ? o : null;
}

async function connect(label, command) {
  const client = new Client({ name: `parity-${label}`, version: "1" });
  const transport = new StdioClientTransport({ command: "/bin/sh", args: ["-c", command], env: process.env, stderr: "pipe" });
  const err = [];
  transport.stderr?.on("data", (b) => { err.push(String(b)); if (err.length > 50) err.shift(); });
  try {
    await client.connect(transport);
  } catch (e) {
    throw new Error(`${label} server did not start: ${e.message}; stderr: ${err.join("").slice(-800)}`);
  }
  const { tools } = await client.listTools();
  return { client, tools: new Set(tools.map((t) => t.name)), close: () => client.close() };
}

async function ask(side, call, timeoutMs) {
  if (!side.tools.has(call.tool)) return null;
  try {
    return await side.client.callTool({ name: call.tool, arguments: call.args }, undefined, { timeout: timeoutMs });
  } catch {
    return null;
  }
}

async function main(argv) {
  const o = parseArgs(argv);
  if (o === null) {
    console.error("usage: parity-mcp.mjs --old '<command>' --new '<command>' --calls <calls.json> [--langs de,en] [--stub-log <file>] [--out <file>] [--jobs N] [--budget-s N] [--call-timeout-s N]");
    return 2;
  }
  const calls = JSON.parse(readFileSync(o.calls, "utf8"));
  if (!Array.isArray(calls) || calls.length === 0) { console.error(`parity: ${o.calls} holds no call`); return 2; }
  const langs = o.langs.split(",").map((s) => s.trim()).filter(Boolean);
  const deadline = Date.now() + Number(o["budget-s"]) * 1000;
  const timeoutMs = Number(o["call-timeout-s"]) * 1000;
  let sides;
  try {
    sides = await Promise.all([connect("old", o.old), connect("new", o.new)]);
  } catch (e) {
    console.error(`parity: ${e.message}`);
    return 2;
  }
  const [oldS, newS] = sides;
  const work = langs.flatMap((lang) => calls.map((c) => ({ ...c, lang, args: { ...c.args, language: lang } })));
  const rows = [];
  let next = 0, outOfTime = false;
  const worker = async () => {
    while (next < work.length) {
      if (Date.now() > deadline) { outOfTime = true; return; }
      const call = work[next++];
      const [a, b] = await Promise.all([ask(oldS, call, timeoutMs), ask(newS, call, timeoutMs)]);
      const oldView = a === null ? null : viewOf(a), newView = b === null ? null : viewOf(b);
      rows.push({ tool: call.tool, lang: call.lang, kind: call.kind ?? "golden", ...classify(oldView, newView), old: judgeOld(oldView) });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Number(o.jobs)) }, worker));
  await Promise.all([oldS.close(), newS.close()]);
  const table = tableOf(rows);
  console.log(table);
  if (o.out) writeFileSync(o.out, `${table}\n`);
  const unknown = stubUnknown(o["stub-log"]);
  const gaps = seedGaps(rows);
  if (outOfTime) console.error(`parity: the budget of ${o["budget-s"]} s ran out after ${rows.length} of ${work.length} calls`);
  if (unknown.length > 0) console.error(`parity: the provider stub saw ${unknown.length} request(s) it does not know, first: ${unknown[0]}`);
  if (gaps.length > 0) console.error(`parity: no old answer that is neither empty nor stale for: ${gaps.join(", ")} (the seed does not reach them)`);
  if (outOfTime || unknown.length > 0 || gaps.length > 0) return 2;
  const off = rows.filter((r) => r.verdict !== "identical").length;
  console.error(`parity: ${rows.length} pairs, ${rows.length - off} identical, ${off} not`);
  return off === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = await main(process.argv.slice(2));
export { main };
