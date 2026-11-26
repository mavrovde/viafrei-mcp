import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * No word or pattern table at module level. Stryker treats a mutant that runs while a module loads as static,
 * and each static mutant runs the whole suite. osm-words.ts's table (~1,000 mutants) held shard 6 of the 2.7.4
 * and 2.7.5 publishes past its 20-minute limit. A cancelled shard leaves no report, so the gather's STATIC_MAX
 * never sees that case; this test refuses the table before any mutation run (Stryker's dry run runs it too).
 * The rule: a module-level const whose initialiser is an object, array, Map, Set or regex literal holds at most
 * TABLE_MAX literals that run at load (strings, numbers, templates, regexes; those inside a function run later
 * and are not counted). A bigger table goes in a function that builds it per call. ALLOWED keeps today's bigger
 * tables at their current size as a ratchet: lower an entry when its table shrinks, drop it when the table goes,
 * never raise one.
 */
const TABLE_MAX = 24;
const ALLOWED: Readonly<Record<string, number>> = {
  "src/tools/station-sections.ts:W": 112,
  "src/usage-names.ts:MCP_USAGE_CLIENTS": 59,
  "src/tools/facilities.ts:PLATFORM_COPY": 36,
  "src/tools/station-page.ts:W": 32,
  "src/tools/location.ts:LOCATION_WORDS": 28,
  "src/tools/nearby.ts:LABEL": 26,
};

const ROOT = join(import.meta.dirname, "..");

function unwrap(n: ts.Expression): ts.Expression {
  for (;;) {
    if (ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isParenthesizedExpression(n)) n = n.expression;
    else if (ts.isCallExpression(n) && n.expression.getText() === "Object.freeze" && n.arguments.length === 1) n = n.arguments[0]!;
    else return n;
  }
}

const isTable = (n: ts.Expression): boolean => ts.isObjectLiteralExpression(n) || ts.isArrayLiteralExpression(n) || ts.isRegularExpressionLiteral(n)
  || (ts.isNewExpression(n) && /^(?:Map|Set)$/u.test(n.expression.getText()));

/** The literals a module evaluates when it loads: none inside a function. */
function loadLiterals(n: ts.Node): number {
  if (ts.isFunctionLike(n)) return 0;
  let c = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isNumericLiteral(n) || ts.isRegularExpressionLiteral(n) || ts.isTemplateExpression(n) ? 1 : 0;
  ts.forEachChild(n, (x) => { c += loadLiterals(x); });
  return c;
}

/** Every module-level table of one source: `file:name` → its literal count. */
function tablesOf(file: string, text: string): Map<string, number> {
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = new Map<string, number>();
  for (const st of src.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (d.initializer === undefined) continue;
      const init = unwrap(d.initializer);
      if (isTable(init)) out.set(`${file}:${d.name.getText(src)}`, loadLiterals(init));
    }
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
  const all = new Map(sources(join(ROOT, "src")).filter((f) => f !== "src/api/operations.ts").flatMap((f) => [...tablesOf(f, readFileSync(join(ROOT, f), "utf8"))]));

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
  });
});
