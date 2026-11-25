import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Attribution } from "../src/api/client.js";
import { creditWithLinks, shareAlikeNote, toolResult, type Language } from "../src/presentation.js";
import { LIVE_SHARE_ALIKE_SUBJECT } from "../src/tools/departure-words.js";

// Today's server's credit rows, copied from the parity run's old answers (fixtures/credit-golden.json).
const golden = JSON.parse(readFileSync(new URL("./fixtures/credit-golden.json", import.meta.url), "utf8")) as {
  cases: { attribution: Attribution; today: string }[];
  shareAlike: { language: Language; licence: string; today: string }[];
  shareAlikeRows: { cases: { language: Language; licences: string[]; today: string }[] };
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

describe("a share-alike credit carries today's share-alike sentence, after the credit line", () => {
  for (const c of golden.shareAlike) {
    it(`${c.licence} (${c.language})`, () => {
      const a: Attribution = { family: "sa", text: "Echtzeitdaten: X", licence: c.licence, shareAlike: true };
      expect(shareAlikeNote([a], c.language)).toBe(c.today);
      const meta = { requestId: "r", generatedAt: "2026-03-30T00:00:00Z", language: c.language, asOf: "2026-03-30T00:00:00Z", freshness: [], attribution: [a] };
      const lines = (toolResult("B", [meta], c.language).content[0] as { text: string }).text.split("\n");
      expect(lines.slice(-2)[0]).toMatch(/^(Quelle|Source): Echtzeitdaten: X/u);
      expect(lines.at(-1)).toBe(c.today);
    });
  }
  // The source already says "CC BY-SA 4.0" (our own licence: one name, no "so lizenziert sie die Quelle"),
  // and two share-alike sources whose licences differ (both named, joined by " / ").
  for (const c of golden.shareAlikeRows.cases) {
    it(`${c.licences.join(" + ")} (${c.language}), recorded from today's server`, () => {
      const rows: Attribution[] = c.licences.map((licence, i) => ({ family: `sa${i}`, text: `Daten ${i}`, licence, shareAlike: true }));
      expect(shareAlikeNote(rows, c.language)).toBe(c.today);
      const meta = { requestId: "r", generatedAt: "2026-03-30T00:00:00Z", language: c.language, asOf: "2026-03-30T00:00:00Z", freshness: [], attribution: rows };
      expect((toolResult("B", [meta], c.language).content[0] as { text: string }).text.split("\n").at(-1)).toBe(c.today);
    });
  }
  it("a departure board names what is share-alike: its realtime figures (today's LIVE_SHARE_ALIKE_SUBJECT, recorded 2026-11-25)", () => {
    const a: Attribution = { family: "sa", text: "Echtzeitdaten: X", licence: "CC BY-SA", shareAlike: true };
    expect(shareAlikeNote([a], "de", LIVE_SHARE_ALIKE_SUBJECT.de)).toBe("Die Echtzeitangaben aus DELFI GTFS-RT und DELFI SIRI ET stehen unter CC BY-SA (Share-alike), so lizenziert sie die Quelle; unsere Bearbeitung geben wir unter CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/) weiter: wer sie weitergibt oder daraus etwas Neues ableitet, muss das Ergebnis unter derselben Lizenz und mit dieser Quellenangabe weitergeben.");
    expect(shareAlikeNote([{ ...a, licence: "CC BY-SA 4.0" }], "en", LIVE_SHARE_ALIKE_SUBJECT.en)).toMatch(/^The realtime figures from DELFI GTFS-RT and DELFI SIRI ET are licensed CC BY-SA 4\.0 /u);
    const meta = { requestId: "r", generatedAt: "2026-03-30T00:00:00Z", language: "en" as const, asOf: "2026-03-30T00:00:00Z", freshness: [], attribution: [a] };
    expect((toolResult("B", [meta], "en", { shareAlikeSubject: LIVE_SHARE_ALIKE_SUBJECT.en }).content[0] as { text: string }).text.split("\n").at(-1)).toBe("The realtime figures from DELFI GTFS-RT and DELFI SIRI ET are licensed CC BY-SA (share-alike) by their source; we release our adaptation under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/): anyone who passes them on, or builds something on them, must release the result under the same licence and with this attribution.");
  });
  it("no sentence for a share-alike database that is not Creative Commons, nor for a credit that is not share-alike", () => {
    expect(shareAlikeNote([{ family: "osm", text: "OSM", licence: "ODbL 1.0", shareAlike: true }], "de")).toBeUndefined();
    expect(shareAlikeNote([{ family: "x", text: "X", licence: "CC BY-SA", shareAlike: false }], "de")).toBeUndefined();
  });
});
