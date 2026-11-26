import { describe, it } from "vitest";
import { KIND_WORD, kreisWord, LAENDER, PLACE_KIND } from "../src/tools/find-place.js";
import { pinned } from "./pinned.js";

const KINDS = ["municipality", "district", "region", "station_area", "stop", "motorway", "junction", "island"];
// A Kreis key, a kreisfreie Stadt's key, a city-state's key, and names that say their kind already or do not.
const ROWS = [
  ["09162123", "Ebersberg"], ["09162123", "Vogtlandkreis"], ["09162123", "Region Hannover"], ["09162123", "Stadtverband Saarbrücken"],
  ["09162123", "Stadtregion Aachen"], ["09162123", "Städteregion Aachen"], ["09162123", "STADTEREGION X"], ["05113000", "Essen"],
  ["11000000", "Berlin"], ["0916212", "kurz"], ["09162123", null],
] as const;

describe("find_place's words: kinds, Länder and the Kreis a row lies in", () => {
  it("every kind, Land and Kreis word in German and in English", async () => {
    const both = (f: (l: "de" | "en") => string | null | undefined) => `${String(f("de"))} / ${String(f("en"))}`;
    await pinned("find-place", [
      ...Object.entries(KIND_WORD()).map(([k, w]) => `kind ${k}: ${w.de} / ${w.en}`),
      ...Object.entries(LAENDER()).map(([k, w]) => `land ${k}: ${w.de} / ${w.en}`),
      ...Object.entries(PLACE_KIND()).map(([k, v]) => `asked ${k}: ${v}`),
      ...KINDS.flatMap((kind) => ROWS.map(([districtCode, districtName]) => `kreis ${kind} ${districtCode} ${String(districtName)}: ${both((l) => kreisWord({ kind, districtCode, districtName }, l))}`)),
    ].join("\n"));
  });
});
