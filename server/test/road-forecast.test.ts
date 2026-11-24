import { describe, expect, it } from "vitest";
import type * as T from "../src/api/types.js";
import { roadFamilies, roadForecastAnswer, selectStations } from "../src/tools/road-forecast.js";
import { drivingKeys } from "../src/tools/weather-block.js";

const now = new Date("2026-11-24T21:13:30Z");
const h = (validAt: string, roadCondition: number | null, surfaceTempC: number | null, runAt = "2026-11-24T18:00:00Z"): T.RoadForecastHour => ({ validAt, runAt, roadCondition, surfaceTempC });
const st = (o: Partial<T.RoadForecastStation>): T.RoadForecastStation => ({
  id: "s", name: "Kreuz Nord", segmentType: 1, positionSource: null, location: { lat: 52, lon: 9 }, distanceM: 900, hours: [], sourceFamily: "dwd_road", forecastFamily: "dwd_road_forecast", ...o,
});

describe("the DWD road-surface forecast, as today's server reads and words it", () => {
  it("the hour for now is the first not before the request's minute; slippery from class 3; hours past 24 h left out; nearest first", () => {
    const picked = selectStations([
      st({ id: "far", distanceM: 950, hours: [h("2026-11-24T21:00:00Z", 1, 2)] }),
      st({ id: "near", hours: [h("2026-11-25T21:14:00Z", 6, -3), h("2026-11-24T21:13:00Z", 2, 1), h("2026-11-24T23:00:00Z", 2, 0.5), h("2026-11-25T02:00:00Z", 3, -0.2)] }),
    ], now);
    expect(picked.map((p) => p.station.id)).toEqual(["near", "far"]);
    expect(picked[0]!.next?.validAt).toBe("2026-11-24T21:13:00Z");
    expect(picked[0]!.firstSlippery?.validAt).toBe("2026-11-25T02:00:00Z");
    expect(picked[0]!.lastValidAt).toBe("2026-11-25T02:00:00Z");
    // The far station's only hour is over: no hour for now, its last hour named.
    expect(picked[1]!.next).toBeNull();
    expect(selectStations([st({ hours: [] })], now)).toEqual([]);
    // Class 2 is not slippery; a class not given is not either.
    expect(selectStations([st({ hours: [h("2026-11-24T22:00:00Z", 2, 0), h("2026-11-24T23:00:00Z", null, null)] })], now)[0]!.firstSlippery).toBeNull();
  });

  it("the lines: a station with no current hour, an unknown class, a missing temperature, an open road", () => {
    const a = roadForecastAnswer("en", [st({ hours: [h("2026-11-24T21:00:00Z", 2, 1)] }), st({ name: "Brücke X", segmentType: null, distanceM: 30, hours: [h("2026-11-24T22:00:00Z", 0, null)] })], now);
    expect(a.shown).toBe(true);
    expect(a.anySlippery).toBe(false);
    expect(a.text!.split("\n").slice(1)).toEqual([
      "- Station Brücke X (30 m) — forecast 23:00: class 0, road-surface temperature not given; no slippery class forecast until 2026-11-25 22:13.",
      "- Station Kreuz Nord (open road, 0.9 km) — no current forecast: this run's last forecast hour (22:00) has passed.",
      "Each line is for the station's own location, not for the whole road.",
    ]);
    const de = roadForecastAnswer("de", [st({ hours: [h("2026-11-24T22:00:00Z", null, -1.25)] })], now);
    expect(de.text!.split("\n")[1]).toBe("- Station Kreuz Nord (freie Strecke, 0,9 km) — Prognose 23:00: Zustand nicht angegeben, Fahrbahn −1,2 °C; bis 25.11. 22:13 keine Glätte-Klasse prognostiziert.");
  });

  it("the run: 4 h old is current, a second more a caution first; 24 h old shown, a second more one sentence and nothing shown", () => {
    const at = (runAt: string) => roadForecastAnswer("en", [st({ hours: [h("2026-11-24T22:00:00Z", 1, 4, runAt)] })], now);
    expect(at("2026-11-24T17:13:30Z").text!.startsWith("DWD road-surface forecast")).toBe(true);
    expect(at("2026-11-24T17:13:29Z").text!.startsWith("Caution, not current: this forecast run (18:13) is more than 4 hours old. DWD road-surface forecast")).toBe(true);
    expect(at("2026-11-23T21:13:30Z").shown).toBe(true);
    expect(at("2026-11-23T21:13:29Z")).toEqual({ text: "DWD road-surface forecast currently unavailable: the latest forecast run held is more than 24 hours old.", shown: false, anySlippery: false });
    expect(roadForecastAnswer("en", undefined, now)).toEqual({ text: null, shown: false, anySlippery: false });
    expect([...roadFamilies([st({}), st({ sourceFamily: "other_road" })])]).toEqual(["dwd_road", "dwd_road_forecast", "other_road"]);
  });

  it("a FROST warning earns the winter-tyre line only with a slippery forecast; an ice warning always", () => {
    expect(drivingKeys(1, "FROST")).toEqual(["generic"]);
    expect(drivingKeys(1, "FROST", true)).toEqual(["ice"]);
    expect(drivingKeys(1, "STURMBÖEN", true)).toEqual(["gusts"]);
    expect(drivingKeys(2, "GLATTEIS", false)).toEqual(["ice"]);
  });
});
