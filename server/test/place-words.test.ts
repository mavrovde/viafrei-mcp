import { describe, it } from "vitest";
import { placeWords } from "../src/tools/place-words.js";
import { pinned } from "./pinned.js";

describe("what a tool says with no place or an unknown one, as today's server says it", () => {
  it("every tool's words in German and in English, and its flags", async () => {
    await pinned("place-words", Object.entries(placeWords()).flatMap(([tool, w]) => [
      `${tool}${w.ignorePlace === true ? " (ignores place)" : ""}${w.uncoded === true ? " (uncoded)" : ""}`,
      `  missing de: ${w.missing.de}`,
      `  missing en: ${w.missing.en}`,
      ...(w.unknown === undefined ? [] : [`  unknown de: ${w.unknown.de("Xy")}`, `  unknown en: ${w.unknown.en("Xy")}`]),
    ]).join("\n"));
  });
});
