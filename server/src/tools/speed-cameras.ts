/**
 * find_speed_cameras, in today's server's words (tools/find_speed_cameras.ts): the planning notice first (the
 * API's condition note; in English also its German original), then the official lists by kind, OpenStreetMap's
 * cameras in a block of their own, each with its own "more" count, and one Stand line per source: when it was
 * read, and the publication's own date. The rows, their order and the counts are the API's; the words are ours.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DataMeta } from "../api/client.js";
import type * as T from "../api/types.js";
import { toolResult, type Language } from "../presentation.js";
import { atParam, isResult, num, position, type Handler } from "./context.js";

export const DEFAULT_RADIUS_KM = 5;

/** The notice in German, which an English answer also shows in its original wording. */
export const SPEED_NOTICE_DE = "Hinweis zur Nutzung (§ 23 Abs. 1c StVO): Wer ein Fahrzeug führt, darf während der Fahrt kein technisches Gerät und keine App-Funktion betreiben oder nutzen, die Verkehrsüberwachungsmaßnahmen anzeigt oder stört. Das gilt auch für das Smartphone eines Beifahrers, wenn der Fahrer davon profitiert (OLG Karlsruhe). Verstöße kosten 75 € und einen Punkt in Flensburg. Diese Angaben sind nur zur Planung vor Fahrtantritt oder während eines Halts bestimmt. Die Standorte stammen aus amtlichen und offenen Quellen und können unvollständig oder veraltet sein; mobile Kontrollen sind jederzeit und überall möglich. Halten Sie sich immer an die geltende Höchstgeschwindigkeit. Keine Rechtsberatung.";

const KIND_WORDS: Record<Language, Record<string, string>> = {
  de: { fixed: "Feste Anlagen", section_control: "Abschnittskontrollen", mobile_announced: "Angekündigte mobile Kontrollen", measuring_site: "Messstellen aus der Standorttabelle der Stadt" },
  en: { fixed: "Fixed cameras", section_control: "Section control", mobile_announced: "Announced mobile checks", measuring_site: "Measuring sites from the city's site table" },
};
const ENFORCES_WORDS: Record<Language, Record<string, string>> = {
  de: { speed: "Geschwindigkeit", red_light: "Rotlicht", speed_red_light: "Geschwindigkeit und Rotlicht" },
  en: { speed: "speed", red_light: "red light", speed_red_light: "speed and red light" },
};

const radiusText = (km: number, language: Language): string => (language === "de" ? String(km).replace(".", ",") : String(km));

const COPY = {
  de: {
    head: (where: string, km: string) => `Geschwindigkeitsüberwachung — veröffentlichte Standorte für ${where} (Umkreis ${km} km), nach Art und Straße:`,
    none: (where: string, km: string) => `Für ${where} (Umkreis ${km} km) ist in unseren Quellen kein Standort veröffentlicht. Das heißt nicht, dass dort nicht kontrolliert wird.`,
    more: (n: number) => `… und ${n} weitere Standorte in diesem Gebiet.`,
    moreOsm: (n: number) => `… und ${n} weitere in OpenStreetMap eingetragene Anlagen in diesem Gebiet.`,
    hgv: (kmh: number) => `Lkw ${kmh} km/h`,
    direction: "Richtung",
    dates: (from: string | null, to: string | null) => (from !== null && to !== null && from !== to ? `${from} bis ${to}` : `am ${from ?? to ?? ""}`),
    stand: (src: string, read: string, published: string | null) => `Stand ${src}: gelesen ${read}${published === null ? "" : `, Datenstand ${published}`}`,
    stale: (year: number) => `Datenstand ${year}, älter als ein Jahr`,
    unnamed: "Ort ohne Straßenangabe",
    original: [] as string[],
  },
  en: {
    head: (where: string, km: string) => `Speed enforcement — published locations for ${where} (radius ${km} km), by kind and street:`,
    none: (where: string, km: string) => `No location is published in our sources for ${where} (radius ${km} km). That does not mean there are no checks there.`,
    more: (n: number) => `… and ${n} more locations in this area.`,
    moreOsm: (n: number) => `… and ${n} more cameras mapped in OpenStreetMap in this area.`,
    hgv: (kmh: number) => `HGV ${kmh} km/h`,
    direction: "direction",
    dates: (from: string | null, to: string | null) => (from !== null && to !== null && from !== to ? `${from} to ${to}` : `on ${from ?? to ?? ""}`),
    stand: (src: string, read: string, published: string | null) => `Stand ${src}: read ${read}${published === null ? "" : `, data as of ${published}`}`,
    stale: (year: number) => `data from ${year}, over a year old`,
    unnamed: "place without a street",
    original: ["The notice in its original wording (German):", SPEED_NOTICE_DE, ""],
  },
} as const;

/** A calendar day in the answer's language: "22.11.2026", "2026-11-22". */
export function calendarDay(day: string, language: Language): string {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(day)) return day;
  return language === "de" ? `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}` : day;
}

/** The Berlin calendar day of an instant, as `calendarDay` says it. */
const berlinDay = (iso: string, language: Language): string =>
  calendarDay(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)), language);

/** The source's own name: its credit line before the colon ("Blitzer (OpenStreetMap)"). */
const sourceName = (meta: DataMeta, family: string): string => {
  const text = meta.attribution?.find((a) => a.family === family)?.text;
  return text === undefined ? family : (text.split(":")[0] ?? text).trim();
};

const coordText = (c: T.SpeedCamera): string | null => (c.location === null ? null : `${c.location.lat.toFixed(5)}, ${c.location.lon.toFixed(5)}`);

/**
 * The sentence a list without announced mobile checks ends with (round Q49 "mobile Blitzer in Bielefeld" listed
 * fixed cameras and never said that no source announces a mobile check there). Built per call, so its words are
 * no module-level table.
 */
export function noMobileLine(language: Language): string {
  return language === "de"
    ? "Angekündigte mobile Kontrollen: Für dieses Gebiet kündigt keine unserer Quellen eine an. Mobile Kontrollen sind trotzdem jederzeit und überall möglich."
    : "Announced mobile checks: none of our sources announces one for this area. Mobile checks are still possible anywhere at any time.";
}

/** The notice in English, as the API's English condition note and place-words' unknown-place sentence say it. */
export function speedNoticeEn(): string {
  return "Note on use (§ 23 Abs. 1c StVO): a person driving a vehicle may not, while driving, operate or use any technical device or app function that shows or disrupts traffic enforcement. This also applies to a passenger's smartphone if the driver benefits from it (OLG Karlsruhe). A violation costs €75 and one point in Flensburg. This information is meant only for planning before setting off or during a stop. The locations come from official and open sources and may be incomplete or out of date; mobile checks are possible at any time and anywhere. Always keep to the speed limit in force. Not legal advice.";
}

/** The planning notice an answer opens with: German, or English followed by its German original. */
export function speedNotice(language: Language): string {
  return language === "de" ? SPEED_NOTICE_DE : `${speedNoticeEn()}\nThe notice in its original wording (German):\n${SPEED_NOTICE_DE}`;
}

/**
 * A place answer that is not a camera list (the candidates of a shared town name, a refusal) still opens with the
 * notice, in its text and, where it has structured content, as the list's planningOnly and noticeDe (mcp #291:
 * the "Neustadt" candidates came without it). An answer that already says it (the unknown place) is left as is.
 */
export function withSpeedNotice(r: CallToolResult, language: Language): CallToolResult {
  const [first, ...rest] = r.content;
  const text = first?.type === "text" ? first.text : "";
  if (text.includes("§ 23 Abs. 1c StVO")) return r;
  return {
    ...r,
    content: [{ type: "text", text: `${speedNotice(language)}\n\n${text}` }, ...(first?.type === "text" ? rest : r.content)],
    ...(r.structuredContent === undefined ? {} : { structuredContent: { ...r.structuredContent, planningOnly: true, noticeDe: SPEED_NOTICE_DE } }),
  };
}

export const findSpeedCameras: Handler = async (args, ctx): Promise<CallToolResult> => {
  const { language } = ctx;
  const c = COPY[language];
  const pos = await position(args, ctx);
  if (isResult(pos)) return withSpeedNotice(pos, language);
  const radiusKm = num(args["radius_km"]) ?? DEFAULT_RADIUS_KM;
  const r = await ctx.api.get<T.SpeedData>("listSpeedCameras", { at: atParam(pos.at), radius_m: Math.round(radiusKm * 1000), limit: num(args["limit"]) });
  const where = pos.label ?? `${pos.at.lat.toFixed(3)}, ${pos.at.lon.toFixed(3)}`;
  const km = radiusText(radiusKm, language);
  const line = (x: T.SpeedCamera): string => {
    const place = [x.street ?? x.locationLabel ?? coordText(x) ?? c.unnamed, ...(x.municipality === null ? [] : [x.municipality])].join(", ");
    const parts = [
      ...(x.enforces === null ? [] : [ENFORCES_WORDS[language][x.enforces] ?? x.enforces]),
      ...(x.limitKmh === null ? [] : [`${x.limitKmh} km/h`]),
      ...(x.lorryLimitKmh === null ? [] : [c.hgv(x.lorryLimitKmh)]),
      ...(x.direction === null ? [] : [`${c.direction} ${x.direction}`]),
      ...(x.kind === "mobile_announced" && (x.firstDay !== null || x.lastDay !== null) ? [c.dates(x.firstDay, x.lastDay)] : []),
      ...(x.staleYear === null ? [] : [c.stale(x.staleYear)]),
    ];
    return `- ${place} — ${parts.join(" · ")}`;
  };
  const { official, osm } = r.data;
  const text: string[] = [...c.original];
  if (official.length + osm.length === 0) {
    text.push(c.none(where, km));
  } else {
    text.push(c.head(where, km));
    let group: string | null = null;
    for (const x of official) {
      if (x.kind !== group) { group = x.kind; text.push(`${KIND_WORDS[language][x.kind] ?? x.kind}:`); }
      text.push(line(x));
    }
    if (r.data.officialTotal > official.length) text.push(c.more(r.data.officialTotal - official.length));
    if (osm.length > 0) {
      text.push(`${KIND_WORDS[language]["fixed"]} (OpenStreetMap):`);
      for (const x of osm) text.push(line(x));
      if (r.data.osmTotal > osm.length) text.push(c.moreOsm(r.data.osmTotal - osm.length));
    }
    if (!official.some((x) => x.kind === "mobile_announced")) text.push(noMobileLine(language));
  }
  // One Stand per source of the rows shown, in the order they first appear: when it was read, its newest own date.
  const rows = [...official, ...osm];
  const families = [...new Set(rows.map((x) => x.sourceFamily))];
  const stands = families.map((family) => {
    const readAt = r.meta.freshness?.find((f) => f.family === family)?.dataAsOf ?? r.meta.generatedAt;
    const published = rows.filter((x) => x.sourceFamily === family && x.dataAsOf !== null).map((x) => x.dataAsOf as string).sort().at(-1) ?? null;
    return { source: family, name: sourceName(r.meta, family), readAt, dataAsOf: published };
  });
  for (const s of stands) text.push(c.stand(s.name, berlinDay(s.readAt, language), s.dataAsOf === null ? null : calendarDay(s.dataAsOf, language)));
  const locations = rows.map((x) => ({
    kind: x.kind,
    kindLabel: KIND_WORDS[language][x.kind] ?? x.kind,
    enforces: x.enforces,
    enforcesLabel: x.enforces === null ? null : (ENFORCES_WORDS[language][x.enforces] ?? x.enforces),
    street: x.street,
    locationText: x.locationLabel,
    municipality: x.municipality,
    direction: x.direction,
    maxSpeedKmh: x.limitKmh,
    maxSpeedHgvKmh: x.lorryLimitKmh,
    validFrom: x.firstDay,
    validTo: x.lastDay,
    dataAsOf: x.dataAsOf,
    staleYear: x.staleYear,
    lat: x.location?.lat ?? null,
    lon: x.location?.lon ?? null,
    source: x.sourceFamily,
  }));
  // Nothing shown: the time we looked, as today's server says it.
  const asOf = stands.length === 0 ? r.meta.generatedAt : [...stands.map((s) => s.readAt)].sort().at(-1);
  return toolResult(text.join("\n"), [r.meta], language, {
    ...(asOf === undefined ? {} : { asOf }),
    structured: {
      place: where,
      radiusKm,
      locations,
      total: r.data.officialTotal,
      osmTotal: r.data.osmTotal,
      stand: stands,
      planningOnly: true,
      noticeDe: SPEED_NOTICE_DE,
    },
  });
};
