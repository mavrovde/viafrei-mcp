import { describe, expect, it } from "vitest";
import type * as T from "../src/api/types.js";
import { zoneDetail } from "../src/tools/location.js";

const zone = (o: Partial<T.LowEmissionZone>): T.LowEmissionZone => ({ verdict: "inside", zone: "Umweltzone München", distanceM: null, liftedOn: null, exemptRoad: null, releasedArea: null, plaque: null, dataDate: null, boundaryReadAt: null, ...o });
const green: T.ZonePlaque = { from: "curated_entry", entry: "München", plakette: "green", covered: true };

describe("describe_location's zone lines under the head, as today's lezAnswerLines says them", () => {
  it("inside: the green plaque, then the day the boundary was last read", () => {
    expect(zoneDetail(zone({ plaque: green, boundaryReadAt: "2026-11-17T23:30:00Z" }), "en")).toEqual([
      "Required: the green plaque (emission group 4). You can buy it at vehicle registration offices, TÜV/DEKRA/GTÜ/KÜS and approved garages on presentation of the vehicle registration document (part I).",
      "Zone boundary last read on 2026-11-18.",
    ]);
    expect(zoneDetail(zone({ plaque: green, boundaryReadAt: "2026-11-17T23:30:00Z" }), "de")).toEqual([
      "Erforderlich: die grüne Plakette (Schadstoffgruppe 4). Sie gibt es bei Zulassungsstellen, TÜV/DEKRA/GTÜ/KÜS und anerkannten Werkstätten gegen Vorlage der Zulassungsbescheinigung Teil I.",
      "Zonengrenze zuletzt abgerufen am 18.11.2026.",
    ]);
  });
  it("the publisher's date before our read; the exempt road and the released area inside", () => {
    expect(zoneDetail(zone({ exemptRoad: "B 2R", releasedArea: "Parkplatz Nord", dataDate: "2025-06-24", boundaryReadAt: "2026-11-17T12:00:00Z" }), "de")).toEqual([
      "Der Punkt liegt auf der B 2R, die laut Herausgeber nicht zur Umweltzone gehört.",
      "Er liegt in der freigegebenen Fläche „Parkplatz Nord“.",
      "Stand der Zonendaten: 24.06.2025 (Angabe des Herausgebers).",
    ]);
    expect(zoneDetail(zone({ exemptRoad: "B 2R", releasedArea: "P Nord", dataDate: "2025-06-24" }), "en")).toEqual([
      "The point is on the B 2R, which the publisher lists as not part of the zone.",
      "It lies in the released area “P Nord”.",
      "Zone data as of 2025-06-24 (the publisher's date).",
    ]);
  });
  it("the national fact with its source and doubt; an entry stating no plaque says none", () => {
    expect(zoneDetail(zone({ plaque: { from: "national_fact", entry: null, plakette: null, covered: null } }), "en")[0]).toMatch(/^In practice every signposted Umweltzone .* \(Umweltbundesamt, Umweltzonen in Deutschland; not confirmed: .* — check the source\)$/u);
    expect(zoneDetail(zone({ plaque: { from: "national_fact", entry: null, plakette: null, covered: null } }), "de")[0]).toMatch(/^Praktisch alle .* bitte an der Quelle nachlesen\)$/u);
    expect(zoneDetail(zone({ plaque: { ...green, plakette: null, covered: false } }), "en")).toEqual([]);
  });
  it("outside: no road or area lines; a lifted zone: nothing under its head", () => {
    expect(zoneDetail(zone({ verdict: "outside", exemptRoad: "B 2R", releasedArea: "P", boundaryReadAt: "2026-11-17T12:00:00Z" }), "en")).toEqual(["Zone boundary last read on 2026-11-17."]);
    expect(zoneDetail(zone({ liftedOn: "2024-01-01", plaque: green, boundaryReadAt: "2026-11-17T12:00:00Z" }), "en")).toEqual([]);
  });
});
