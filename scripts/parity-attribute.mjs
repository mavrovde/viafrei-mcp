#!/usr/bin/env node
/**
 * Attributes every differing row of a parity run (the rows parity-mcp.mjs writes, one JSON
 * object per line, each with `views.old` and `views.new`) to a cause, exactly.
 *
 *   node scripts/parity-attribute.mjs <rows.jsonl>
 *
 * A row is attributed to a set of MASKS only if old and new become identical once that set is
 * applied to both sides; the smallest such set wins, and it is printed whole, so a row that needs
 * a database gap AND a server fix says both. A row no set makes identical is never given a gap:
 * it is an isError flip (by direction) or, failing that, "unexplained".
 *
 * Masks: db#72 (the "Keine offene Quelle" line against the "no report" line), db#83 (a weather
 * warning's body lines), db#84 (the credit of an empty road answer), db#85 (the road head's fold
 * of reasons and its count line), structuredContent (dropped), "structuredContent outside the
 * API" (only the keys the API contract names are compared: parity pending the API), credit (the
 * credit line, the share-alike sentence after it and `_meta.attribution` / `_meta.license` / `_meta.shareAlike`). A db mask only removes what its gap names.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The key names the API contract carries (the pinned OpenAPI copy); a structuredContent key outside it waits on the API. */
const CONTRACT = new Set([...readFileSync(new URL("../server/test/fixtures/api-openapi.json", import.meta.url), "utf8").matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"\s*:/gu)].map((m) => m[1]));
const pruneToContract = (v) => Array.isArray(v) ? v.map(pruneToContract)
  : v !== null && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => CONTRACT.has(k)).map(([k, x]) => [k, pruneToContract(x)])) : v;

const ROAD = new Set(["check_road_status", "find_roadworks_ahead", "check_autobahn_traffic"]);
const CREDIT = /^(Quelle|Quellen|Source|Sources): /u;
const BARE_STAND = /^(Stand|As of) \d{2}:\d{2}$/u;
/** The share-alike sentence that follows a share-alike credit: it goes where the credit goes. */
const SHARE_ALIKE = /^(Diese Angaben|These figures|Die aufgeführten Störungsmeldungen|The service alerts listed) (stehen unter|are licensed) .+ \((Share-alike|share-alike)\)/u;
const EMPTY_ROAD = /Es liegt keine Meldung vor|there is no report/u;
const NO_OPEN_SOURCE = /^(Keine offene Quelle für diesen Abschnitt|No open source for this section)/u;
const WARNING_HEAD = /^\d+\. (Stufe|Level) /u;
const FOLD = / \((und \d+ weitere Gründe|and \d+ more reasons?)\)/gu;
const ROAD_COUNTS = /gesamte Strecke:|whole route:|\d+ Sperrungen, \d+ Einschränkungen|\d+ closures, \d+ restrictions/u;

const dropCredit = (a) => {
  // The footer goes whole: a credit line ("Quelle: … · Stand 10:00"), or the bare Stand an answer without a credit ends with.
  a.t = a.t.filter((l) => !CREDIT.test(l) && !SHARE_ALIKE.test(l) && !BARE_STAND.test(l));
  delete a.m.attribution;
  delete a.m.license;
  delete a.m.shareAlike;
};

/** Each mask edits one side in place; `emptyRoad` tells whether the NEW answer is the empty road answer. */
export const MASKS = {
  "db#72": (a) => { a.t = a.t.filter((l) => !NO_OPEN_SOURCE.test(l) && !EMPTY_ROAD.test(l)); },
  "db#83": (a, tool) => {
    if (tool !== "check_weather_warnings") return;
    const out = [];
    let block = false;
    for (const l of a.t) {
      if (WARNING_HEAD.test(l)) { block = true; continue; }
      if (block && (l.startsWith("   ") || l === "")) continue;
      block = false;
      if (l.startsWith("- ")) continue;
      out.push(l);
    }
    a.t = out;
  },
  "db#84": (a, tool, emptyRoad) => { if (ROAD.has(tool) && emptyRoad) dropCredit(a); },
  "db#85": (a, tool) => {
    if (!ROAD.has(tool)) return;
    a.t = a.t.map((l) => l.replace(FOLD, "")).filter((l) => !ROAD_COUNTS.test(l));
  },
  // Before the plain structuredContent mask: of two masks that both make a row identical, the
  // narrower one names it.
  "structuredContent outside the API": (a) => { a.s = a.s === null ? null : pruneToContract(a.s); },
  structuredContent: (a) => { a.s = null; },
  credit: (a) => dropCredit(a),
};
const NAMES = Object.keys(MASKS);

const side = (x) => ({ e: x?.isError === true, t: String(x?.text ?? "").split("\n"), m: { ...(x?.meta ?? {}) }, s: x?.structuredContent ?? null });
const canon = (v) => JSON.stringify(v, (_k, val) => (val !== null && typeof val === "object" && !Array.isArray(val) ? Object.fromEntries(Object.keys(val).sort().map((k) => [k, val[k]])) : val));

function masked(row, names) {
  const o = side(row.views?.old), n = side(row.views?.new);
  const emptyRoad = EMPTY_ROAD.test(n.t.join("\n"));
  for (const k of names) { MASKS[k](o, row.tool, emptyRoad); MASKS[k](n, row.tool, emptyRoad); }
  return [o, n];
}

function* subsets(size, from = 0, acc = []) {
  if (acc.length === size) { yield acc; return; }
  for (let i = from; i < NAMES.length; i++) yield* subsets(size, i + 1, [...acc, NAMES[i]]);
}

/** The cause of one row: "identical", the smallest mask set joined by " + ", an isError flip, or "unexplained". */
export function attribute(row) {
  if (row.verdict === "identical") return "identical";
  for (let size = 1; size <= NAMES.length; size++) {
    for (const set of subsets(size)) {
      const [o, n] = masked(row, set);
      if (canon(o) === canon(n)) return set.join(" + ");
    }
  }
  const [o, n] = masked(row, NAMES);
  if (o.e !== n.e) return n.e ? "isError: an answer today, an error here" : "isError: an error today, an answer here";
  return "unexplained";
}

/** Counts per cause, each with its per-tool counts. */
export function tally(rows) {
  const out = new Map();
  for (const r of rows) {
    const k = attribute(r);
    const e = out.get(k) ?? { count: 0, tools: new Map() };
    e.count++;
    e.tools.set(r.tool, (e.tools.get(r.tool) ?? 0) + 1);
    out.set(k, e);
  }
  return [...out.entries()].sort((a, b) => b[1].count - a[1].count);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error("usage: parity-attribute.mjs <rows.jsonl>"); process.exit(2); }
  const rows = readFileSync(file, "utf8").split("\n").filter((l) => l.trim() !== "").map((l) => JSON.parse(l));
  console.log("| cause | answers | tools |\n|-|-|-|");
  for (const [k, e] of tally(rows)) {
    const tools = [...e.tools.entries()].sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t} ${c}`).join(", ");
    console.log(`| ${k} | ${e.count} | ${k === "identical" ? "" : tools} |`);
  }
  console.log(`| total | ${rows.length} | |`);
  const pending = rows.filter((r) => attribute(r) === "structuredContent outside the API").length;
  const exact = rows.filter((r) => r.verdict === "identical").length;
  console.log(`\nexact parity: ${exact}/${rows.length}; parity pending the API: ${exact + pending}/${rows.length}`);
}
