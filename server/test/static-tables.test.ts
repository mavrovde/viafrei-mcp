import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * No word or pattern table at module level. Stryker treats a mutant that runs while a module loads as static,
 * and each static mutant runs the whole suite. osm-words.ts's table (~1,000 mutants) held shard 6 of the 2.7.4
 * and 2.7.5 publishes past its 20-minute limit. A cancelled shard leaves no report, so the gather's STATIC_MAX
 * never sees that case; this test refuses the table first, in the server suite (server.yml, every pull
 * request). It is NOT in Stryker's runs: vitest.stryker.config.ts leaves it out, because Stryker mutates the
 * sources in place and this test would then read the instrumented code (and Stryker's `related` selection does
 * not pick it either: it imports no source).
 * The rule: each top-level statement evaluates at most TABLE_MAX literals when the module loads (strings,
 * numbers, templates, regexes) — a const's initializer whatever builds it (a literal, a call, a
 * `new Map(Object.entries(…))`), a class's static fields and blocks, an expression statement or an
 * `export default`. Literals inside a function, a type or an instance field run later and are not counted.
 * A bigger table goes in a function that builds it per call. ALLOWED keeps today's bigger ones at their
 * current size as a ratchet: lower an entry when it shrinks, drop it when it goes, never raise one.
 */
const TABLE_MAX = 24;
const ALLOWED: Readonly<Record<string, number>> = {
  "src/tools/station-sections.ts:W": 112,
  "src/usage-names.ts:MCP_USAGE_CLIENTS": 59,
  "src/tools/facilities.ts:PLATFORM_COPY": 36,
  "src/env.ts:mcpEnvSchema": 34,
  "src/tools/station-page.ts:W": 32,
  "src/prompts/types.ts:PRICE_AGGREGATE": 30,
  "src/tools/location.ts:LOCATION_WORDS": 28,
  "src/tools/nearby.ts:LABEL": 26,
};

const ROOT = join(import.meta.dirname, "..");

/** The literals a module evaluates when it loads: none inside a function, a type or an instance field. */
function loadLiterals(n: ts.Node): number {
  if (ts.isFunctionLike(n) || ts.isTypeNode(n)) return 0;
  if (ts.isPropertyDeclaration(n) && !(ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Static)) return 0;
  let c = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isNumericLiteral(n) || ts.isRegularExpressionLiteral(n) || ts.isTemplateExpression(n) ? 1 : 0;
  ts.forEachChild(n, (x) => { c += loadLiterals(x); });
  return c;
}

/**
 * What one source evaluates when it loads, by top-level statement: `file:name` for a declared const, let or
 * var and for a class (its static fields and blocks), `file:line N` for any other statement (an expression
 * statement, an `export default`, an enum). Imports, re-exports, types and function declarations run nothing.
 */
function tablesOf(file: string, text: string): Map<string, number> {
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = new Map<string, number>();
  const add = (key: string, n: number) => { if (n > 0) out.set(key, (out.get(key) ?? 0) + n); };
  for (const st of src.statements) {
    if (ts.isImportDeclaration(st) || ts.isImportEqualsDeclaration(st) || (ts.isExportDeclaration(st)) || ts.isTypeAliasDeclaration(st)
      || ts.isInterfaceDeclaration(st) || ts.isFunctionDeclaration(st) || ts.isModuleDeclaration(st)) continue;
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) add(`${file}:${d.name.getText(src)}`, d.initializer === undefined ? 0 : loadLiterals(d.initializer));
    else if (ts.isClassDeclaration(st)) add(`${file}:${st.name?.getText(src) ?? "class"}`, st.members.reduce((c, m) => c + loadLiterals(m), 0));
    else add(`${file}:line ${src.getLineAndCharacterOfPosition(st.getStart(src)).line + 1}`, loadLiterals(st));
  }
  return out;
}

/** The tables over their bound (TABLE_MAX, or the ALLOWED size), as `file:name n > bound`. */
function overBound(tables: ReadonlyMap<string, number>): string[] {
  return [...tables].filter(([k, n]) => n > (ALLOWED[k] ?? TABLE_MAX)).map(([k, n]) => `${k} ${n} > ${ALLOWED[k] ?? TABLE_MAX}`);
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [relative(ROOT, p).split("\\").join("/")] : [];
  });
}

const many = (n: number, f: (i: number) => string): string => Array.from({ length: n }, (_, i) => f(i)).join(", ");

describe("no word or pattern table at module level (Stryker would mutate it statically)", () => {
  // The scope mutation.mjs mutates: every source but the generated operation table.
  const all = new Map(sources(join(ROOT, "src")).filter((f) => f !== "src/api/operations.ts" && f !== "src/content/home-page.ts").flatMap((f) => [...tablesOf(f, readFileSync(join(ROOT, f), "utf8"))]));

  it(`every module-level table holds at most ${TABLE_MAX} literals, or its allowed size`, () => {
    expect(overBound(all)).toEqual([]);
  });
  it("every allowed table still exists at exactly its allowed size (a ratchet: lower it when it shrinks)", () => {
    expect(Object.entries(ALLOWED).filter(([k, n]) => all.get(k) !== n).map(([k, n]) => `${k} allowed ${n}, is ${String(all.get(k))}`)).toEqual([]);
  });
  it("a planted table one literal over the bound is refused; at the bound, or built in a function, it is not", () => {
    const over = many(TABLE_MAX + 1, (i) => `k${i}: "w${i}"`);
    expect(overBound(tablesOf("src/x.ts", `export const T = { ${over} } as const;`))).toEqual([`src/x.ts:T ${TABLE_MAX + 1} > ${TABLE_MAX}`]);
    expect(overBound(tablesOf("src/x.ts", `const T = new Map([${many(13, (i) => `["${i}", /a${i}/u]`)}]);`))).toEqual([`src/x.ts:T 26 > ${TABLE_MAX}`]);
    expect(overBound(tablesOf("src/x.ts", `const T: readonly string[] = [${many(TABLE_MAX + 1, (i) => `\`t${i}\``)}];`))).toHaveLength(1);
    expect(overBound(tablesOf("src/x.ts", `const T = new Set([${many(TABLE_MAX + 1, (i) => String(i))}]);`))).toHaveLength(1);
    expect(overBound(tablesOf("src/x.ts", `export const T = Object.freeze({ ${many(TABLE_MAX, (i) => `k${i}: "w${i}"`)} });`))).toEqual([]);
    expect(overBound(tablesOf("src/x.ts", `export function T() { return { ${over} }; }`))).toEqual([]);
    expect(overBound(tablesOf("src/x.ts", `const T = { f: () => [${many(TABLE_MAX + 1, (i) => `"${i}"`)}] };`))).toEqual([]);
    const words = `[${many(TABLE_MAX + 1, (i) => `"${i}"`)}]`;
    expect(overBound(tablesOf("src/x.ts", `const T = build(${words});`))).toEqual([`src/x.ts:T ${TABLE_MAX + 1} > ${TABLE_MAX}`]);
    expect(overBound(tablesOf("src/x.ts", `const T = new Map(Object.entries({ ${over} }));`))).toHaveLength(1);
    expect(overBound(tablesOf("src/x.ts", `import { x } from "./y.js";\nregister(${words});`))).toEqual([`src/x.ts:line 2 ${TABLE_MAX + 1} > ${TABLE_MAX}`]);
    expect(overBound(tablesOf("src/x.ts", `export default { words: ${words} };`))).toHaveLength(1);
    expect(overBound(tablesOf("src/x.ts", `class C { static readonly W = ${words}; }`))).toEqual([`src/x.ts:C ${TABLE_MAX + 1} > ${TABLE_MAX}`]);
    expect(overBound(tablesOf("src/x.ts", `class C { static { init(${words}); } }`))).toHaveLength(1);
    expect(overBound(tablesOf("src/x.ts", `class C { readonly w = ${words}; m() { return ${words}; } }`))).toEqual([]);
    expect(overBound(tablesOf("src/x.ts", `type W = ${many(TABLE_MAX + 1, (i) => `"${i}"`).replaceAll(", ", " | ")};\nconst w: ${many(TABLE_MAX + 1, (i) => `"${i}"`).replaceAll(", ", " | ")} = "1";`))).toEqual([]);
  });
});
