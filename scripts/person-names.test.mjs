#!/usr/bin/env node
// Self-test of the person-name rule (person-names.mjs). No network, no git.
import { isTestPath, personNameFindings } from "./person-names.mjs";

let failed = 0, passed = 0;
const check = (name, ok) => { if (ok) { passed++; console.log(`  PASS  ${name}`); } else { failed++; console.log(`  FAIL  ${name}`); } };
const T = "server/test/usage.test.ts";
// Built from parts, so this file holds no name-shaped literal of its own.
const K = ["Klaus", "Beispielmann"].join(" ");
const A = ["Anna", "Probe"].join(" ");
const P = ["Peter", "Test"].join(" ");

check("a given and a family name in a test literal is a finding", personNameFindings(T, `const x = "${K}'s laptop";`).length === 1);
check("single and double quotes are read", personNameFindings(T, `a('${A}'); b("${P}")`).length === 2);
check("the placeholders pass", personNameFindings(T, `["Max Mustermann", "Erika Mustermann", "John Doe"]`).length === 0);
check("a name outside a literal is not read (a comment, an identifier)", personNameFindings(T, `// written by ${K}\nconst Paul = 1;`).length === 0);
check("a hyphenated street or a lower-case word is not a name", personNameFindings(T, `"Karl-Marx-Allee 1", "Anna liest"`).length === 0);
check("a file that is not a test is not read", personNameFindings("server/src/usage.ts", `"${K}"`).length === 0);
check("the finding names the line and the length, never the name", (() => { const [f] = personNameFindings(T, `\n"${K}"`); return f !== undefined && f.startsWith(`${T}:2 `) && !f.includes("Klaus") && f.includes("(18 characters)"); })());
check("the label is printed when given (the history leg's commit:path)", personNameFindings(T, `"${K}"`, `abc1234:${T}`)[0]?.startsWith(`abc1234:${T}:1 `) === true);
check("test paths: test/, fixtures/, *.test.*", isTestPath("test/a.ts") && isTestPath("server/test/fixtures/x.json") && isTestPath("scripts/a.test.mjs") && !isTestPath("server/src/a.ts"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
