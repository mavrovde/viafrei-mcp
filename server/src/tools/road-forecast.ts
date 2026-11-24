/**
 * The DWD road-surface forecast beside a weather answer, as today's server words it (its road-weather lines
 * and the road-weather selection rules): per
 * station the hour for now, the first slippery hour (class 3 and above) inside the next 24 hours, a caution when
 * the run is more than 4 hours old, and no forecast at all, only a sentence, when it is more than 24 hours old.
 *
 * The API (data.roadForecast) gives the nearest 3 stations within 25 km, nearest first, with their hours from 60
 * minutes before the answer to 24 hours after it; this file only selects and words. The disclaimer the forecast
 * is shown under is the API's own condition note (meta.notes), shown verbatim by toolResult.
 */
import type * as T from "../api/types.js";
import { standTime, type Language } from "../presentation.js";
import { kmText } from "./nearby.js";

export const ROAD_FORECAST_LOOKAHEAD_H = 24;
export const RUN_STALE_MS = 4 * 3_600_000;
export const RUN_UNAVAILABLE_MS = 24 * 3_600_000;
export const SLIPPERY_FROM = 3;

const CLASS_WORDS: Readonly<Record<number, { readonly de: string; readonly en: string }>> = {
  1: { de: "trocken", en: "dry" },
  2: { de: "feucht", en: "damp" },
  3: { de: "Schnee", en: "snow" },
  4: { de: "Reif", en: "hoar frost" },
  5: { de: "überfrierende Nässe", en: "freezing wet surface" },
  6: { de: "Glatteis", en: "glaze ice" },
};

type Hour = T.RoadForecastHour;
export type StationForecast = { station: T.RoadForecastStation; next: Hour | null; firstSlippery: Hour | null; lastValidAt: string };

/** Today's slot rule: an hour is not over while its valid time is not before the request's minute. */
const slotNotOver = (validAt: string, now: Date): boolean => new Date(validAt).getTime() >= Math.floor(now.getTime() / 60_000) * 60_000;

/** Per station with hours: the hour for now, the first slippery hour, the last hour held (today's selectStationForecasts). */
export function selectStations(stations: readonly T.RoadForecastStation[], now: Date): StationForecast[] {
  const until = now.getTime() + ROAD_FORECAST_LOOKAHEAD_H * 3_600_000;
  return stations.flatMap((station) => {
    const hours = [...station.hours].filter((h) => new Date(h.validAt).getTime() <= until).sort((a, b) => Date.parse(a.validAt) - Date.parse(b.validAt));
    const last = hours.at(-1);
    if (last === undefined) return [];
    const upcoming = hours.filter((h) => slotNotOver(h.validAt, now));
    return [{ station, next: upcoming[0] ?? null, firstSlippery: upcoming.find((h) => h.roadCondition !== null && h.roadCondition >= SLIPPERY_FROM) ?? null, lastValidAt: last.validAt }];
  }).sort((a, b) => a.station.distanceM - b.station.distanceM);
}

export function roadForecastUnavailableLine(language: Language): string {
  return language === "de"
    ? "Straßenwetter-Prognose des DWD derzeit nicht verfügbar: Der letzte vorliegende Prognoselauf ist älter als 24 Stunden."
    : "DWD road-surface forecast currently unavailable: the latest forecast run held is more than 24 hours old.";
}

function classWord(language: Language, rc: number | null): string {
  if (rc === null) return language === "de" ? "Zustand nicht angegeben" : "condition not given";
  const w = CLASS_WORDS[rc];
  if (w === undefined) return language === "de" ? `Klasse ${rc}` : `class ${rc}`;
  return language === "de" ? w.de : w.en;
}

function temp(language: Language, ts: number | null): string {
  if (ts === null) return language === "de" ? "Fahrbahntemperatur nicht angegeben" : "road-surface temperature not given";
  const v = (Math.round(ts * 10) / 10).toFixed(1).replace("-", "−");
  return language === "de" ? `Fahrbahn ${v.replace(".", ",")} °C` : `road surface ${v} °C`;
}

const segmentWord = (language: Language, s: number | null): string | null =>
  s === 2 ? (language === "de" ? "Brücke" : "bridge") : s === 1 ? (language === "de" ? "freie Strecke" : "open road") : null;

function stationLine(language: Language, s: StationForecast, now: Date): string {
  const de = language === "de";
  const seg = segmentWord(language, s.station.segmentType);
  const where = `${s.station.name} (${seg === null ? "" : `${seg}, `}${kmText(s.station.distanceM, language)})`;
  const at = (iso: string): string => standTime(iso, language, now);
  if (s.next === null) {
    return de
      ? `- Station ${where} — keine aktuelle Prognose: die letzte Prognosestunde dieses Laufs (${at(s.lastValidAt)}) ist vorbei.`
      : `- Station ${where} — no current forecast: this run's last forecast hour (${at(s.lastValidAt)}) has passed.`;
  }
  const nextText = `${at(s.next.validAt)}: ${classWord(language, s.next.roadCondition)}, ${temp(language, s.next.surfaceTempC)}`;
  const until = new Date(now.getTime() + ROAD_FORECAST_LOOKAHEAD_H * 3_600_000).toISOString();
  const slip = s.firstSlippery;
  const slipText = slip === null
    ? de ? `bis ${at(until)} keine Glätte-Klasse prognostiziert` : `no slippery class forecast until ${at(until)}`
    : de ? `Prognose: Glätte-Klasse ab ${at(slip.validAt)} — ${classWord("de", slip.roadCondition)}, ${temp("de", slip.surfaceTempC)}`
      : `forecast: slippery class from ${at(slip.validAt)} — ${classWord("en", slip.roadCondition)}, ${temp("en", slip.surfaceTempC)}`;
  return de ? `- Station ${where} — Prognose ${nextText}; ${slipText}.` : `- Station ${where} — forecast ${nextText}; ${slipText}.`;
}

/** What the answer says of the road surface: the block, the unavailable sentence, or nothing; and whether a station forecasts slipperiness. */
export type RoadAnswer = { text: string | null; shown: boolean; anySlippery: boolean };

export function roadForecastAnswer(language: Language, stations: readonly T.RoadForecastStation[] | undefined, now: Date): RoadAnswer {
  const picked = selectStations(stations ?? [], now);
  // Today reads the run of the nearest station's first hour.
  const runAt = picked[0]?.station.hours.slice().sort((a, b) => Date.parse(a.validAt) - Date.parse(b.validAt))[0]?.runAt;
  if (runAt === undefined) return { text: null, shown: false, anySlippery: false };
  const age = now.getTime() - Date.parse(runAt);
  if (age > RUN_UNAVAILABLE_MS) return { text: roadForecastUnavailableLine(language), shown: false, anySlippery: false };
  const de = language === "de";
  const run = standTime(runAt, language, now);
  const anySlippery = picked.some((s) => s.firstSlippery !== null);
  const caution = age <= RUN_STALE_MS ? ""
    : de ? `Achtung, nicht aktuell: Dieser Prognoselauf (${run}) ist älter als ${RUN_STALE_MS / 3_600_000} Stunden. `
      : `Caution, not current: this forecast run (${run}) is more than ${RUN_STALE_MS / 3_600_000} hours old. `;
  const head = caution + (de
    ? `Straßenwetter-Prognose des DWD für die nächsten Straßenwetterstationen (Modellvorhersage SWSMOS/METRo, Lauf ${run} — keine Messung und keine amtliche Warnung):`
    : `DWD road-surface forecast for the nearest road-weather stations (SWSMOS/METRo model forecast, run ${run} — not a measurement and not an official warning):`);
  const lines = [head, ...picked.map((s) => stationLine(language, s, now))];
  if (anySlippery) {
    lines.push(de
      ? "Eine prognostizierte Glätte-Klasse ist eine Modellvorhersage für diesen Punkt, keine amtliche Glättewarnung des DWD."
      : "A forecast slippery class is a model forecast for that point, not an official DWD ice warning.");
  }
  lines.push(de ? "Jede Zeile gilt für den Standort der Station, nicht für die ganze Strecke." : "Each line is for the station's own location, not for the whole road.");
  return { text: lines.join("\n"), shown: true, anySlippery };
}

/** The families a road forecast credits: the stations' and the forecast hours'. */
export function roadFamilies(stations: readonly T.RoadForecastStation[] | undefined): Set<string> {
  return new Set((stations ?? []).flatMap((s) => [s.sourceFamily, s.forecastFamily]));
}
