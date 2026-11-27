/**
 * find_parking {kind: "disabled_badge"}: the on-street bays reserved for a disabled parking permit, read from
 * listParkingBays (kind=disabled). Every sentence is today's server's, verbatim (find_parking.bays.ts): a bay is
 * not a car park, so it is its own answer, never part of "any".
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type * as T from "../api/types.js";
import { toolError, toolResult, type Language } from "../presentation.js";
import { atParam, bool, isResult, num, position, type Args, type ToolContext } from "./context.js";
import { clock, kmText } from "./nearby.js";

const L = (language: Language, de: string, en: string): string => (language === "de" ? de : en);

/** The publishers' time words for a reserved bay, in English. */
const RESERVED_WHEN_EN: Readonly<Record<string, string>> = {
  durchgehend: "at all times",
  "rund um die uhr": "around the clock",
  ganztägig: "all day",
  immer: "at all times",
  werktags: "on working days",
};

/** A publisher's German words in an English answer: quoted and labelled, unless they hold no word at all. */
function providerTextEn(words: string): string {
  const w = words.trim().replace(/\s+/gu, " ");
  if (w === "") return "";
  return /\p{L}{2,}/u.test(w) ? `Provider text (German): "${w}"` : w;
}

/** The bay's address as published: the number not twice, then postcode and town. */
export function bayAddress(b: Pick<T.ParkingBay, "street" | "houseNumber" | "postcode" | "city">): string {
  const street = b.street ?? "";
  const withNo = b.houseNumber !== null && !street.endsWith(` ${b.houseNumber}`) ? `${street} ${b.houseNumber}`.trim() : street;
  const town = [b.postcode, b.city].filter((x): x is string => x !== null && x !== "").join(" ");
  return [withNo, town].filter((x) => x !== "").join(", ");
}

/** A sensor-less site in words: the publisher's count, its times, and that no sensor reports it. */
function staticBayText(language: Language, b: Pick<T.ParkingBay, "spaces" | "reservedWhen">): string {
  const n = String(b.spaces ?? 1);
  const known = b.reservedWhen === null ? undefined : RESERVED_WHEN_EN[b.reservedWhen.trim().toLowerCase()];
  const when = b.reservedWhen === null ? "" : language === "de" ? `, reserviert: ${b.reservedWhen}` : `, reserved: ${known ?? providerTextEn(b.reservedWhen)}`;
  return L(language, `reservierte Plätze: ${n}${when} (kein Sensor, keine Belegung veröffentlicht)`, `reserved spaces: ${n}${when} (no sensor, no occupancy published)`);
}

/** One bay's state: free/occupied with the sensor's time, or unknown with the last time known. */
export function bayStateText(language: Language, b: T.ParkingBay, now: Date): string {
  if (!b.sensor) return staticBayText(language, b);
  const at = b.messageAt === null ? null : clock(b.messageAt, language, now);
  if (b.state === "free") return L(language, `frei (Sensor, ${at ?? "?"})`, `free (sensor, ${at ?? "?"})`);
  if (b.state === "occupied") return L(language, `belegt (Sensor, ${at ?? "?"})`, `occupied (sensor, ${at ?? "?"})`);
  if (at !== null) return L(language, `keine aktuelle Sensormeldung (zuletzt ${at})`, `no current sensor reading (last ${at})`);
  return L(language, "keine Sensormeldung", "no sensor reading");
}

const grouped = (language: Language, n: number): string => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/gu, language === "de" ? "." : ",");
const sites = (language: Language, n: number): string => `${grouped(language, n)} ${n === 1 ? L(language, "Standort", "site") : L(language, "Standorte", "sites")}`;

export async function findDisabledBays(args: Args, ctx: ToolContext): Promise<CallToolResult> {
  const { language } = ctx;
  if (args["road"] !== undefined) {
    return toolError(L(language,
      "Behindertenparkplätze am Straßenrand liegen in Orten, nicht an einer Autobahn: bitte place oder lat/lon statt road angeben.",
      "Disabled-badge bays are on town streets, not along a motorway: pass place or lat/lon instead of road."), "invalid_input", "road_not_point");
  }
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  const radiusKm = num(args["radius_km"]) ?? 10;
  const onlyFree = bool(args["only_with_free_spaces"]) === true;
  const label = pos.label ?? `${pos.at.lat.toFixed(3)}, ${pos.at.lon.toFixed(3)}`;
  const r = await ctx.api.get<T.ParkingBaysData>("listParkingBays", {
    at: atParam(pos.at), kind: "disabled", radius_m: Math.round(radiusKm * 1000), limit: num(args["limit"]) ?? 5, ...(onlyFree ? { only_free: "true" } : {}),
  });
  const now = new Date(r.meta.generatedAt);
  const { bays, counts } = r.data;
  if (bays.length === 0) {
    // Nothing listed, so nothing is credited but the place search.
    const text = onlyFree
      ? L(language,
        `Im Umkreis von ${radiusKm} km um ${label} meldet gerade kein Sensor einen freien Behindertenparkplatz am Straßenrand.`,
        `No sensor reports a free disabled-badge bay on the street within ${radiusKm} km of ${label} right now.`)
      : L(language,
        `Im Umkreis von ${radiusKm} km um ${label} kenne ich keine Behindertenparkplätze am Straßenrand. Ich halte sie nur, wo eine Kommune sie als offene Daten veröffentlicht; Parkhäuser mit Behindertenplätzen nennt find_parking ohne kind.`,
        `I hold no disabled-badge bays on the street within ${radiusKm} km of ${label}. I hold them only where a municipality publishes them as open data; car parks with disabled spaces are listed by find_parking without a kind.`);
    return toolResult(text, [], language, {
      asOf: r.meta.generatedAt,
      structured: { place: label, radiusKm, kind: "disabled_badge", bays: [], bayCounts: { total: 0, sensors: 0, free: 0, occupied: 0, unknown: 0, staticSites: 0, staticSpaces: 0 } },
    });
  }
  const head = L(language,
    `Behindertenparkplätze am Straßenrand um ${label} (Umkreis ${radiusKm} km${onlyFree ? ", nur freie" : ""}), nächste zuerst:`,
    `Disabled-badge bays on the street around ${label} (within ${radiusKm} km${onlyFree ? ", free only" : ""}), nearest first:`);
  const lines = bays.map((b, i) => `${String(i + 1)}. ${bayAddress(b) || b.id} — ${kmText(b.distanceM, language)}, ${bayStateText(language, b, now)}`);
  const sensorCount = counts.sensors === 0 ? "" : L(language,
    `\nIm Umkreis: ${counts.sensors} Behindertenparkplätze mit Sensor, davon ${counts.free} frei und ${counts.occupied} belegt gemeldet; die übrigen ohne aktuelle Meldung.`,
    `\nWithin the radius: ${counts.sensors} disabled-badge bays with a sensor, ${counts.free} reported free and ${counts.occupied} occupied; the rest have no current reading.`);
  const staticCount = counts.staticSites === 0 ? "" : L(language,
    `\nOhne Sensor im Umkreis: ${sites(language, counts.staticSites)} mit ${counts.staticSites === 1 ? "" : "zusammen "}${counts.staticSpaces} reservierten Plätzen — ob ein Platz frei ist, wird nicht veröffentlicht.`,
    `\nWithout a sensor within the radius: ${sites(language, counts.staticSites)} with ${counts.staticSpaces} reserved spaces${counts.staticSites === 1 ? "" : " between them"} — whether a space is free is not published.`);
  const caveat = L(language, "\nNur mit gültigem Parkausweis für Menschen mit Behinderung.", "\nFor holders of a disabled parking permit only.")
    + (counts.sensors === 0 ? "" : L(language, " \"Keine aktuelle Sensormeldung\" heißt unbekannt, nicht frei.", " \"No current sensor reading\" means unknown, not free."));
  return toolResult(`${head}\n${lines.join("\n")}${onlyFree ? "" : `${sensorCount}${staticCount}`}${caveat}`, [r.meta], language, {
    structured: {
      place: label, radiusKm, kind: "disabled_badge", onlyWithFreeSpaces: onlyFree,
      bayCounts: { total: counts.total, sensors: counts.sensors, free: counts.free, occupied: counts.occupied, unknown: counts.unknown, staticSites: counts.staticSites, staticSpaces: counts.staticSpaces },
      bays: bays.map((b) => ({
        bayId: b.id, kind: "disabled_badge", publisherKind: b.publisherKind,
        address: { street: b.street, houseNumber: b.houseNumber, postcode: b.postcode, city: b.city },
        lat: b.lat, lon: b.lon, distanceKm: Math.round((b.distanceM / 1000) * 100) / 100,
        state: b.sensor ? (b.state ?? "unknown") : "no_sensor", sensor: b.sensor, spaces: b.spaces, reservedWhen: b.reservedWhen,
        messageAt: b.messageAt, source: b.sourceFamily,
      })),
    },
  });
}
