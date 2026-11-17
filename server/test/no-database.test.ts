/** The server relies on the ViaFrei API only: no database driver, no SQL, no database word in its sources. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url).pathname;
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}
const sources = walk(join(root, "src"));
const pkg = readFileSync(join(root, "package.json"), "utf8");
const SQL = /\b(SELECT\s+[\s\S]{1,200}?\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+(TABLE|INDEX|VIEW))\b/;

describe("no database", () => {
  it("package.json names no database driver", () => {
    const deps = Object.keys({ ...JSON.parse(pkg).dependencies, ...JSON.parse(pkg).devDependencies });
    expect(deps.filter((d) => /^(pg|pg-.*|postgres|@types\/pg|mysql2?|sqlite3?|better-sqlite3)$/.test(d))).toEqual([]);
    expect(pkg).not.toMatch(/\bpostgres/i);
  });
  it("no source imports pg or names postgres", () => {
    expect(sources.length).toBeGreaterThan(10);
    for (const f of sources) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/from\s+["']pg["']|require\(["']pg["']\)|import\(["']pg["']\)/);
      expect(s, f).not.toMatch(/postgres/i);
    }
  });
  it("no source carries a SQL statement", () => {
    for (const f of sources) expect(readFileSync(f, "utf8"), f).not.toMatch(SQL);
  });
});
