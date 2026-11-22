/**
 * find_hydrogen_station, in today's server's words (main tools/find_hydrogen_station.ts): the head "Wasserstoff-
 * tankstellen für Pkw nahe München (Umkreis 50 km), nächste zuerst:", one numbered line per station with its
 * address, pumps, operator, opening hours and the age of its record, and the note that nothing live is published;
 * with none in the radius, the nearest one beyond it.
 *
 * Today's server folds the publisher's one-row-per-pump records of one site into one line; the API lists them as
 * they come (scratchpad api-gap.md, lane A).
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type * as T from "../api/types.js";
import { toolResult, type Language } from "../presentation.js";
import { atParam, isResult, num, position, str, type Handler } from "./context.js";
import { houseNumberRefusal } from "./house-number.js";
import { kmText } from "./nearby.js";
import { aroundText } from "./weather-words.js";

/** Today's default and largest radius, and default list length. */
const H2_RADIUS_KM = 50;
const H2_MAX_RADIUS_KM = 150;
const H2_STATIONS = 5;

type Vehicle = "car" | "truck" | undefined;
type Address = { street?: string | null; house_number?: string | null; postcode?: string | null; city?: string | null };
type Refill = { solution: string };
type Opening = { day: string; from: string; to: string };

const PUMP_WORDS: Readonly<Record<string, Readonly<Record<Language, string>>>> = {
  gaseousHydrogen700barCar: { de: "700 bar Pkw", en: "700 bar car" },
  gaseousHydrogen350barCar: { de: "350 bar Pkw", en: "350 bar car" },
  gaseousHydrogen350barTruck: { de: "350 bar Lkw/Bus", en: "350 bar truck/bus" },
};
const pumpLabel = (s: string, language: Language): string =>
  PUMP_WORDS[s]?.[language] ?? (language === "de" ? `Wasserstoff (${s})` : `hydrogen (${s})`);

/** "2× 700 bar Pkw, 350 bar Lkw/Bus": one entry per pump class, counted. */
function pumpsText(refill: readonly Refill[], language: Language): string {
  const counts = new Map<string, number>();
  for (const p of refill) counts.set(p.solution, (counts.get(p.solution) ?? 0) + 1);
  return [...counts].map(([s, n]) => `${n > 1 ? `${n}× ` : ""}${pumpLabel(s, language)}`).join(", ");
}

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "publicholidays"] as const;
const DAY_WORDS: Readonly<Record<Language, Readonly<Record<string, string>>>> = {
  de: { monday: "Mo", tuesday: "Di", wednesday: "Mi", thursday: "Do", friday: "Fr", saturday: "Sa", sunday: "So", publicholidays: "Feiertage" },
  en: { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun", publicholidays: "public holidays" },
};

/** The published periods as one line, consecutive weekdays with the same hours folded ("Mo–Fr 06:00–22:00"). */
function openingText(opening: readonly Opening[], language: Language): string {
  const order = DAY_ORDER as readonly string[];
  const byDay = new Map<string, string[]>();
  for (const p of opening) byDay.set(p.day, [...(byDay.get(p.day) ?? []), `${p.from}–${p.to}`]);
  const days = [...DAY_ORDER.filter((d) => byDay.has(d)), ...[...byDay.keys()].filter((d) => !order.includes(d))];
  const word = (d: string): string => DAY_WORDS[language][d] ?? d;
  const groups: { first: string; last: string; hours: string }[] = [];
  for (const d of days) {
    const hours = (byDay.get(d) ?? []).sort().join(", ");
    const prev = groups[groups.length - 1];
    const idx = order.indexOf(d);
    if (prev !== undefined && idx > 0 && idx < 7 && order.indexOf(prev.last) === idx - 1 && prev.hours === hours) prev.last = d;
    else groups.push({ first: d, last: d, hours });
  }
  return groups.map((g) => `${g.first === g.last ? word(g.first) : `${word(g.first)}–${word(g.last)}`} ${g.hours}`).join(", ");
}

/** The Berlin calendar day, as YYYY-MM-DD. */
const berlinYmd = (d: Date): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** "vor 40 Tagen", "gestern", "vor 10 Monaten" (main relativeDayLabel), counted in Berlin calendar days. */
function recordAge(at: Date, now: Date, language: Language): string {
  const delta = Math.round((Date.parse(berlinYmd(at)) - Date.parse(berlinYmd(now))) / 86_400_000);
  const de = language === "de";
  if (delta === 0) return de ? "heute" : "today";
  if (delta === -1) return de ? "gestern" : "yesterday";
  if (delta === 1) return de ? "morgen" : "tomorrow";
  const n = Math.abs(delta);
  const unit = (count: number, deOne: string, deMany: string, enOne: string, enMany: string): string => de
    ? delta < 0 ? `vor ${count} ${count === 1 ? deOne : deMany}` : `in ${count} ${count === 1 ? deOne : deMany}`
    : delta < 0 ? `${count} ${count === 1 ? enOne : enMany} ago` : `in ${count} ${count === 1 ? enOne : enMany}`;
  if (n < 60) return unit(n, "Tag", "Tagen", "day", "days");
  const months = Math.floor(n / 30.44);
  if (months < 24) return unit(months, "Monat", "Monaten", "month", "months");
  return unit(Math.floor(n / 365.25), "Jahr", "Jahren", "year", "years");
}

/** "13.10.2026" / "2026-10-13". */
function dateText(d: Date, language: Language): string {
  const [y, m, day] = berlinYmd(d).split("-");
  return language === "de" ? `${day}.${m}.${y}` : `${y}-${m}-${day}`;
}

/** "Hafenweg 3, 10001 Kansilkamp"; a publisher's "*" (unknown number) is no part of the street. */
function addressText(a: Address | null): string | null {
  if (a === null || typeof a !== "object") return null;
  const name = (a.street ?? "").replace(/\s*\*+\s*/gu, " ").trim();
  const no = (a.house_number ?? "").replace(/\*/gu, "").trim();
  const street = name === "" ? "" : no === "" || new RegExp(`\\S\\s+${no.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`, "iu").test(name) ? name : `${name} ${no}`;
  const town = [a.postcode?.trim() ?? "", a.city?.trim() ?? ""].filter((x) => x !== "").join(" ");
  const out = [street, town].filter((x) => x !== "").join(", ");
  return out === "" ? null : out;
}

const COPY = {
  de: {
    v: (v: Vehicle) => (v === "car" ? " für Pkw" : v === "truck" ? " für Lkw/Bus" : ""),
    head: (where: string, km: string, v: string) => `Wasserstofftankstellen${v} nahe ${where} (Umkreis ${km} km), nächste zuerst:`,
    none: (where: string, km: string, v: string) => `Keine Wasserstofftankstelle${v} im Umkreis von ${km} km um ${where}.`,
    nearest: (line: string) => `Die nächste liegt außerhalb des Umkreises: ${line}`,
    nearestNone: (v: Vehicle) => `In unseren Daten gibt es ${v === undefined ? "überhaupt keine Wasserstofftankstelle" : `keine Wasserstofftankstelle mit ${v === "car" ? "Pkw" : "Lkw/Bus"}-Zapfpunkt`}.`,
    widen: `Radius bis ${H2_MAX_RADIUS_KM} km möglich.`,
    operator: "Betreiber", hours: "Öffnungszeiten", hoursUnknown: "Öffnungszeiten: nicht veröffentlicht (unbekannt)",
    updated: (date: string, age: string) => `Eintrag zuletzt geändert ${date} (${age})`, updatedUnknown: "Änderungsdatum des Eintrags unbekannt",
    noLive: "Verfügbarkeit, Preis und Betriebsstatus veröffentlicht der Betreiber nicht — vor der Fahrt prüfen, ob die Station in Betrieb ist.",
    unnamed: "Wasserstofftankstelle",
  },
  en: {
    v: (v: Vehicle) => (v === "car" ? " for cars" : v === "truck" ? " for trucks/buses" : ""),
    head: (where: string, km: string, v: string) => `Hydrogen stations${v} near ${where} (within ${km} km), nearest first:`,
    none: (where: string, km: string, v: string) => `No hydrogen station${v} within ${km} km of ${where}.`,
    nearest: (line: string) => `The nearest one is outside the radius: ${line}`,
    nearestNone: (v: Vehicle) => `Our data holds ${v === undefined ? "no hydrogen station at all" : `no hydrogen station with a ${v === "car" ? "car" : "truck/bus"} pump`}.`,
    widen: `Radius up to ${H2_MAX_RADIUS_KM} km possible.`,
    operator: "operator", hours: "opening hours", hoursUnknown: "opening hours: not published (unknown)",
    updated: (date: string, age: string) => `record last changed ${date} (${age})`, updatedUnknown: "record date unknown",
    noLive: "No live availability, price or operating status is published — check that the station is working before you drive.",
    unnamed: "Hydrogen station",
  },
} as const;

function stationLine(s: T.HydrogenStation, language: Language, now: Date): string {
  const c = COPY[language];
  const opening = Array.isArray(s.opening) ? (s.opening as Opening[]) : null;
  const updated = s.providerUpdatedAt === null ? null : new Date(s.providerUpdatedAt);
  const address = addressText(s.address as Address | null);
  const parts = [
    kmText(s.distanceM, language),
    ...(address === null ? [] : [address]),
    pumpsText(Array.isArray(s.refill) ? (s.refill as Refill[]) : [], language),
    ...(s.operator === null ? [] : [`${c.operator}: ${s.operator}`]),
    opening === null ? c.hoursUnknown : `${c.hours}: ${openingText(opening, language)}`,
    updated === null ? c.updatedUnknown : c.updated(dateText(updated, language), recordAge(updated, now, language)),
  ];
  return `${s.name ?? s.brand ?? c.unnamed} — ${parts.join(" · ")}`;
}

export const findHydrogenStation: Handler = async (args, ctx): Promise<CallToolResult> => {
  const { language } = ctx;
  const c = COPY[language];
  const refused = await houseNumberRefusal(args, ctx);
  if (refused !== undefined) return refused;
  const pos = await position(args, ctx);
  if (isResult(pos)) return pos;
  const radiusKm = num(args["radius_km"]) ?? H2_RADIUS_KM;
  const vehicle = str(args["vehicle"]) as Vehicle;
  const r = await ctx.api.get<T.HydrogenData>("listHydrogenOptions", {
    at: atParam(pos.at), radius_m: Math.round(radiusKm * 1000), vehicle, limit: num(args["limit"]) ?? H2_STATIONS,
  });
  const now = new Date();
  const where = aroundText(pos.label, pos.at);
  const kmWord = language === "de" ? String(radiusKm).replace(".", ",") : String(radiusKm);
  const text: string[] = [];
  const beyond = r.data.stations.length > 0 ? null : r.data.nearest;
  if (r.data.stations.length > 0) {
    text.push(c.head(where, kmWord, c.v(vehicle)), ...r.data.stations.map((s, i) => `${i + 1}. ${stationLine(s, language, now)}`));
  } else {
    text.push(c.none(where, kmWord, c.v(vehicle)));
    text.push(beyond === null ? c.nearestNone(vehicle) : c.nearest(stationLine(beyond, language, now)));
    if (beyond !== null && radiusKm < H2_MAX_RADIUS_KM && beyond.distanceM <= H2_MAX_RADIUS_KM * 1000) text.push(c.widen);
  }
  if (r.data.stations.length > 0 || beyond !== null) text.push(c.noLive);
  return toolResult(text.join("\n"), [r.meta], language);
};
