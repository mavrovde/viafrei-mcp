import { describe, it } from "vitest";
import { EVENT_EN, hazardLabel } from "../src/tools/weather-block.js";
import { pinned } from "./pinned.js";

describe("the DWD's event words", () => {
  it("every event word, as a German and an English answer label it", async () => {
    await pinned("weather-events", Object.keys(EVENT_EN()).map((word) => `${word}: ${String(hazardLabel("de", word))} / ${String(hazardLabel("en", word))}`).join("\n"));
  });
});
