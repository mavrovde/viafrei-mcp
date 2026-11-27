import { describe, it } from "vitest";
import { KIND_WORD, kreisWord, LAENDER, PLACE_KIND } from "../src/tools/find-place.js";
import { pinned } from "./pinned.js";

// The API's Kreis texts (PlaceItem.kreis): a Kreis, a kreisfreie Stadt bare and named, names that say their kind, none.
const KREISE = ["Kreis Borken", "kreisfreie Stadt", "kreisfreie Stadt München", "Vogtlandkreis", "Region Hannover", "Städteregion Aachen", " ", undefined] as const;

describe("find_place's words: kinds, Länder and the Kreis a row lies in", () => {
  it("every kind, Land and Kreis word in German and in English", async () => {
    const both = (f: (l: "de" | "en") => string | null | undefined) => `${String(f("de"))} / ${String(f("en"))}`;
    await pinned("find-place", [
      ...Object.entries(KIND_WORD()).map(([k, w]) => `kind ${k}: ${w.de} / ${w.en}`),
      ...Object.entries(LAENDER()).map(([k, w]) => `land ${k}: ${w.de} / ${w.en}`),
      ...Object.entries(PLACE_KIND()).map(([k, v]) => `asked ${k}: ${v}`),
      ...KREISE.map((k) => `kreis ${String(k)}: ${both((l) => kreisWord(k, l))}`),
    ].join("\n"));
  });
});
