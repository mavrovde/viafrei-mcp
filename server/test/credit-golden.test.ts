import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Attribution } from "../src/api/client.js";
import { creditWithLinks } from "../src/presentation.js";

// Today's server's credit rows, copied from the parity run's old answers (fixtures/credit-golden.json).
const golden = JSON.parse(readFileSync(new URL("./fixtures/credit-golden.json", import.meta.url), "utf8")) as {
  cases: { attribution: Attribution; today: string }[];
};

describe("a credit row is printed as today's server prints it", () => {
  for (const c of golden.cases) {
    it(c.attribution.family, () => {
      expect(creditWithLinks(c.attribution)).toBe(c.today);
    });
  }
  it("a line that already spells its licence's address gets no second reference", () => {
    const a: Attribution = { family: "x", text: "Daten: X, dl-de/by-2-0 (www.govdata.de/dl-de/by-2-0)", licence: "dl-de/by-2-0", licenceUrl: "https://www.govdata.de/dl-de/by-2-0" };
    expect(creditWithLinks(a)).toBe(a.text);
  });
});
