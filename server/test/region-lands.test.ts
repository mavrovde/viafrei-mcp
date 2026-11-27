import { describe, it } from "vitest";
import { landOf, LANDS } from "../src/tools/region.js";
import { pinned } from "./pinned.js";

describe("the 16 Länder a region may be asked by", () => {
  it("every Land by its German and its English name, folded, answered in both languages", async () => {
    const said = (name: string) => `${JSON.stringify(landOf(name, "de"))} / ${JSON.stringify(landOf(name, "en"))}`;
    await pinned("region", [
      ...LANDS().flatMap((l) => [`${l.code} ${l.de}: ${said(l.de)}`, `${l.code} ${l.en}: ${said(l.en)}`]),
      `folded: ${said("  baden-württemberg ")} | ${said("NORDRHEIN-WESTFALEN")} | ${said("Mecklenburg-Vorpommern")}`,
      `none: ${said("Ruhrgebiet")} | ${said("")}`,
    ].join("\n"));
  });
});
