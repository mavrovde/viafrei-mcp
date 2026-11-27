import { describe, expect, it } from "vitest";
import { familyWords, poiCategoryWord, valueWords } from "../src/tools/osm-words.js";
import { pinned } from "./pinned.js";

describe("find_poi's OSM words, as today's server says them", () => {
  it("every family and value of the catalogue, in German and in English", async () => {
    const families = [...new Set([...Object.keys(familyWords()), ...Object.keys(valueWords())])];
    const said = (family: string, value: string) => `${poiCategoryWord(family, value, "de")} / ${poiCategoryWord(family, value, "en")}`;
    await pinned("osm-words", families.flatMap((family) => [
      `${family}: ${said(family, "")}`,
      ...Object.keys(valueWords()[family] ?? {}).map((value) => `  ${value}: ${said(family, value)}`),
    ]).join("\n"));
  });
  it("outside the catalogue: German says the family, English the readable value; an unknown family is a place", () => {
    expect((["de", "en"] as const).map((l) => poiCategoryWord("amenity", "fuel;car_wash", l))).toEqual(["Einrichtung", "fuel, car wash"]);
    expect((["de", "en"] as const).map((l) => poiCategoryWord("amenity", "yes", l))).toEqual(["Einrichtung", "amenity"]);
    expect(poiCategoryWord("amenity", "car_wash;", "en")).toBe("car wash,");
    expect(poiCategoryWord("tourism", " museum ", "de")).toBe("Museum");
    expect((["de", "en"] as const).map((l) => poiCategoryWord("unknown", "", l))).toEqual(["Ort", "place"]);
    expect((["de", "en"] as const).map((l) => poiCategoryWord("unknown", "some_thing", l))).toEqual(["Ort", "some thing"]);
  });
});
