#!/usr/bin/env node
// Self-test of parity-mcp.mjs: two fake stdio servers (parity-fake-server.mjs) with planted
// differences, run through the real runner, plus its pure parts. No network, no database.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classify, clockish, judgeOld, main, normalise, viewOf } from "./parity-mcp.mjs";
import { keyOf } from "./parity-fake-server.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "parity-test-"));
let failed = 0, passed = 0;
const check = (name, ok, detail = "") => {
  if (ok) { passed++; console.log(`  PASS  ${name}`); } else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};

const res = (text, structured, meta = {}, isError = false) => ({ content: [{ type: "text", text }], structuredContent: structured, _meta: { attribution: "Quelle: X", license: "CC BY 4.0", ...meta }, ...(isError ? { isError: true } : {}) });
const write = (name, value) => { const p = join(dir, name); writeFileSync(p, typeof value === "string" ? value : JSON.stringify(value)); return p; };
const server = (name, tools, answers) => `node ${join(here, "parity-fake-server.mjs")} ${write(name, { tools, answers })}`;
const answersOf = (pairs, lang) => Object.fromEntries(pairs.map(([tool, args, r]) => [keyOf(tool, { ...args, language: lang }), r]));

// The planted cases: [tool, args, old answer, new answer (undefined = the new server lacks the tool)].
const CASES = [
  ["same", { place: "A" }, res("A: 1,739 €", { asOf: "2026-01-01T10:00:00Z", requestId: "r1", stations: [{ id: 1, price: 1.739 }] }, { asOf: "2026-01-01T10:00:00Z" }),
    res("A: 1,739 €", { stations: [{ price: 1.739, id: 1 }], requestId: "r2", asOf: "2026-01-01T10:00:09Z" }, { asOf: "2026-01-01T10:00:09Z" })],
  ["nested", { place: "B" }, res("B: 3 Plätze", { sites: [{ id: "p", spaces: { free: 3, kind: "car" } }] }), res("B: 3 Plätze", { sites: [{ id: "p", spaces: { free: 3, kind: "lorry" } }] })],
  ["attrib", { place: "C" }, res("C", { items: [1] }), res("C", { items: [1] }, { attribution: "Quelle: Y" })],
  ["purpose", { place: "C" }, res("C", { items: [1] }, { purposeNote: "nur privat" }), res("C", { items: [1] })],
  ["order", { place: "D" }, res("D:\n- a\n- b", { items: ["a", "b"] }), res("D:\n- b\n- a", { items: ["b", "a"] })],
  ["numeric", { place: "E" }, res("E: 1,739 €", { items: [{ id: "x", price: 1.739 }] }), res("E: 1,749 €", { items: [{ id: "x", price: 1.749 }] })],
  ["errflag", { place: "F" }, res("F", { items: [1] }), res("F", { items: [1] }, {}, true)],
  ["clock", { place: "G" }, res("G", { departures: [{ id: "t", expectedAt: "2026-01-01T10:05:00Z" }] }), res("G", { departures: [{ id: "t", expectedAt: "2026-01-01T10:06:00Z" }] })],
  ["missing", { topic: "x" }, res("rules", { rules: ["r"] }), undefined],
];
const toolsOld = CASES.map((c) => c[0]);
const toolsNew = CASES.filter((c) => c[3] !== undefined).map((c) => c[0]);
const calls = write("calls.json", CASES.map(([tool, args]) => ({ tool, args, kind: "golden" })));
const oldA = (langs) => Object.assign({}, ...langs.map((l) => answersOf(CASES.map(([t, a, o]) => [t, a, o]), l)));
const newA = (langs) => Object.assign({}, ...langs.map((l) => answersOf(CASES.filter((c) => c[3] !== undefined).map(([t, a, , n]) => [t, a, n]), l)));

const run = async (args) => {
  const log = [], err = [];
  const [ol, oe] = [console.log, console.error];
  console.log = (...a) => log.push(a.join(" "));
  console.error = (...a) => err.push(a.join(" "));
  try {
    return { code: await main(args), out: log.join("\n"), err: err.join("\n") };
  } finally {
    [console.log, console.error] = [ol, oe];
  }
};
const rowOf = (out, tool, lang = "de") => {
  const line = out.split("\n").find((l) => l.startsWith(`| ${tool} | ${lang} |`));
  if (line === undefined) return null;
  const c = line.split(/(?<!\\)\|/u).slice(1, -1).map((s) => s.trim());
  return { calls: +c[2], identical: +c[3], order: +c[4], numeric: +c[5], differing: +c[6], empty: +c[7], stale: +c[8], first: c[9] };
};

{
  const r = await run(["--old", server("old.json", toolsOld, oldA(["de", "en"])), "--new", server("new.json", toolsNew, newA(["de", "en"])), "--calls", calls, "--langs", "de,en", "--jobs", "3"]);
  check("planted differences → exit 1", r.code === 1, `${r.code} ${r.err}`);
  check("asOf and requestId (structuredContent and _meta) and key order are normalised → identical", rowOf(r.out, "same")?.identical === 1, r.out);
  check("a nested structuredContent value with the same text → differing, its path named", rowOf(r.out, "nested")?.differing === 1 && /structuredContent\.sites\[0\]\.spaces\.kind/u.test(rowOf(r.out, "nested")?.first ?? ""), rowOf(r.out, "nested")?.first);
  check("_meta.attribution differing → differing", rowOf(r.out, "attrib")?.differing === 1 && /meta\.attribution/u.test(rowOf(r.out, "attrib")?.first ?? ""));
  check("a purposeNote on one side only → differing", rowOf(r.out, "purpose")?.differing === 1 && /meta\.purposeNote/u.test(rowOf(r.out, "purpose")?.first ?? ""));
  check("the same items in another order → order only", rowOf(r.out, "order")?.order === 1);
  check("a price alone differing → numeric only", rowOf(r.out, "numeric")?.numeric === 1);
  check("isError on one side → differing", rowOf(r.out, "errflag")?.differing === 1 && /isError/u.test(rowOf(r.out, "errflag")?.first ?? ""));
  check("an instant differing → marked clock?", /^clock\? /u.test(rowOf(r.out, "clock")?.first ?? ""), rowOf(r.out, "clock")?.first);
  check("a real difference is not marked clock?", !/clock\?/u.test(rowOf(r.out, "nested")?.first ?? "x"));
  check("a call missing on the new side → differing, never identical", rowOf(r.out, "missing")?.differing === 1 && rowOf(r.out, "missing")?.identical === 0);
  check("de and en are rows of their own", rowOf(r.out, "same", "de")?.calls === 1 && rowOf(r.out, "same", "en")?.calls === 1);
}

const SAME = [["t1", { place: "A" }, res("A", { items: [1] })], ["t2", { place: "B" }, res("B", { items: [2] })]];
const sameServer = (name, pairs) => server(name, [...new Set(pairs.map((p) => p[0]))], answersOf(pairs, "de"));
const sameCalls = (pairs) => write(`calls-${pairs.length}.json`, pairs.map(([tool, args]) => ({ tool, args })));
{
  const r = await run(["--old", sameServer("o2.json", SAME), "--new", sameServer("n2.json", SAME), "--calls", sameCalls(SAME), "--langs", "de"]);
  check("every pair identical → exit 0", r.code === 0, `${r.code} ${r.err}`);
  const stub = write("stub.log", "GET unknown-origin /x\n");
  const s = await run(["--old", sameServer("o2.json", SAME), "--new", sameServer("n2.json", SAME), "--calls", sameCalls(SAME), "--langs", "de", "--stub-log", stub]);
  check("the provider stub logged an unknown request → exit 2, even when every pair is identical", s.code === 2 && /does not know/u.test(s.err), `${s.code} ${s.err}`);
  const quiet = write("quiet.log", "");
  const q = await run(["--old", sameServer("o2.json", SAME), "--new", sameServer("n2.json", SAME), "--calls", sameCalls(SAME), "--langs", "de", "--stub-log", quiet]);
  check("an empty stub log → no objection", q.code === 0, `${q.code} ${q.err}`);
}
{
  const EMPTY = [...SAME, ["t3", { place: "Z" }, res("Z: nichts", { items: [] })], ["t4", { place: "S" }, res("S", { items: [1], board: { stale: true } })]];
  const r = await run(["--old", sameServer("o3.json", EMPTY), "--new", sameServer("n3.json", EMPTY), "--calls", sameCalls(EMPTY), "--langs", "de"]);
  check("a tool whose every old answer is empty or stale → exit 2, naming it", r.code === 2 && /t3, t4/u.test(r.err), `${r.code} ${r.err}`);
  check("empty and stale old answers are counted per tool", rowOf(r.out, "t3")?.empty === 1 && rowOf(r.out, "t4")?.stale === 1 && rowOf(r.out, "t1")?.empty === 0, r.out);
}
{
  const r = await run(["--old", "exit 3", "--new", sameServer("n4.json", SAME), "--calls", sameCalls(SAME), "--langs", "de"]);
  check("a server that does not start → exit 2", r.code === 2 && /old server did not start/u.test(r.err), r.err);
  const u = await run(["--old", "x"]);
  check("no --new or --calls → usage, exit 2", u.code === 2);
}

// The pure parts.
check("normalise drops asOf/requestId at every depth and sorts keys", JSON.stringify(normalise({ b: 1, asOf: 1, a: { requestId: 2, z: [{ asOf: 3, y: 1 }] } })) === '{"a":{"z":[{"y":1}]},"b":1}');
check("viewOf keeps only the compared _meta members", JSON.stringify(viewOf(res("x", null, { other: 1, shareAlike: true })).meta) === '{"attribution":"Quelle: X","license":"CC BY 4.0","shareAlike":true}');
check("a missing old answer is empty", judgeOld(null).empty === true);
check("an error answer is empty", judgeOld(viewOf(res("x", null, {}, true))).empty === true);
check("answered:false is stale", judgeOld(viewOf(res("x", { departures: [1], dbTimetables: { answered: false } }))).stale === true);
check("classify: missing on either side is differing", classify(null, viewOf(res("x", {}))).verdict === "differing" && classify(viewOf(res("x", {})), null).verdict === "differing");
check("clockish: an HH:MM in two text lines", clockish({ path: "text line 2", old: "- 10:05 RE 1", new: "- 10:06 RE 1" }));
check("clockish: a plain word is not", !clockish({ path: "text line 1", old: "Pkw", new: "Lkw" }));

rmSync(dir, { recursive: true, force: true });
console.log(`parity-mcp self-test: ${failed === 0 ? "pass" : "FAIL"} (${passed} passed, ${failed} failed)`);
process.exitCode = failed === 0 ? 0 : 1;
