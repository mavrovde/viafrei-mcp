import { describe, expect, it } from "vitest";
import { LAENDER as FIND_PLACE_LAENDER } from "../src/tools/find-place.js";
import { LAENDER } from "../src/tools/station-page.js";
import { pinned } from "./pinned.js";

describe("the station page's Länder", () => {
  it("every Land by its key, in German and in English, the same as find_place says it", async () => {
    await pinned("station-page", Object.entries(LAENDER()).map(([code, [de, en]]) => `${code}: ${de} / ${en}`).join("\n"));
    expect(Object.fromEntries(Object.entries(LAENDER()).map(([code, [de, en]]) => [code, { de, en }]))).toEqual(FIND_PLACE_LAENDER());
  });
});
