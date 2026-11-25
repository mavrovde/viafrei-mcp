/**
 * describe_station from the station page the API builds (the proposed getStationPage): today's server read the page's
 * sections from the database by the page's own rules (the rail lamp, step-free now, the lifts, the platforms, the
 * board, the alerts, parking) and said them in these words (describe_station). Here the API returns
 * those sections and the MCP only says them; the rules stay in one place, the API's, so the page and the tool agree.
 */
import type * as T from "../api/types.js";
import { standTime, type Language } from "../presentation.js";

/** Today's LIST_SHOWN: lines a list shows before it counts the rest. */
export const LIST_SHOWN = 20;
/** Today's RAIL_AMPEL_RULE.lateOverMin. */
export const LATE_OVER_MIN = 5;

type Lamp = T.RailLamp;

/** Today's W. */
const W = {
  de: {
    page: "Bahnhofsseite",
    category: (c: number) => `Bahnhofskategorie ${String(c)}`,
    stepFree: "Stufenfrei jetzt",
    stepFreeNeutral: "Stufenfreier Zugang",
    reachable: "stufenfrei erreichbar",
    reachableUnknown: "stufenfrei laut Inventar, Aufzugzustand unbekannt",
    blocked: "derzeit nicht stufenfrei, Aufzug außer Betrieb",
    stepless: { yes: "Stufenfreier Zugang laut DB: ja", partial: "Stufenfreier Zugang laut DB: teilweise", no: "Stufenfreier Zugang laut DB: nein" },
    lifts: "Aufzüge und Fahrtreppen",
    kind: { elevator: "Aufzug", escalator: "Fahrtreppe", travelator: "Fahrsteig", other: "Anlage" },
    noLocation: "keine Ortsangabe",
    state: { inactive: "außer Betrieb", active: "in Betrieb", unknown: "Zustand unbekannt" },
    reason: "Grund",
    back: "zurück voraussichtlich",
    platforms: "Bahnsteige",
    track: "Gleis",
    facts: { yes: "stufenfrei", partial: "teilweise stufenfrei", no: "nicht stufenfrei", unknown: "Stufenfreiheit unbekannt" },
    height: (h: { readonly min: number; readonly max: number }) => `Bahnsteighöhe ${h.min === h.max ? String(h.min) : `${String(h.min)}–${String(h.max)}`} cm`,
    departures: "Abfahrten",
    cancelled: "fällt aus",
    onTime: "pünktlich",
    noForecast: "ohne Verspätungsangabe",
    plan: "nach Fahrplan",
    instead: "statt",
    replacement: "Ersatzverkehr",
    alerts: "Störungsmeldungen",
    here: "am Bahnhof",
    until: "bis",
    linesWord: "Linien",
    more: (n: number) => `… und ${String(n)} weitere`,
    ampel: "Bahn-Ampel",
    lamp: { red: "Rot", yellow: "Gelb", green: "Grün", unknown: "Grau" } as Record<Lamp, string>,
    ampelWhy: {
      late: (m: number, n: number, of: number) => `Mehr als ${String(m)} Min. verspätet: ${String(n)} von ${String(of)}`,
      cancelled: (n: number, of: number) => `Ausfälle: ${String(n)} von ${String(of)}`,
      median: (m: number) => `Mittlere Verspätung: ${String(m)} Min.`,
      platform: (n: number) => `Gleiswechsel: ${String(n)}`,
      alert: (n: number) => `Störungsmeldungen: ${String(n)}`,
      sight: "Sicht eingeschränkt: Echtzeitdaten möglicherweise veraltet",
      line: (l: string, lamp: string) => `Linie ${l}: ${lamp}`,
      dep: "Abfahrten",
      arr: "Ankünfte",
      green: "Nach unseren Quellen nichts gemeldet – keine Garantie",
      few: "Zu wenige Fahrten für eine Aussage",
      lines: "Ampel je Linie",
      long: "Fernverkehr",
    },
    parking: "Parken und Laden",
    flags: { has_parking: "Parkplatz", has_bicycle_parking: "Fahrradstellplätze", has_car_rental: "Mietwagen", has_taxi_rank: "Taxistand" } as Record<string, string>,
    perDb: "laut DB",
    nearby: (lat: string, lon: string) => `Parkhäuser und Ladesäulen in der Nähe: find_parking bzw. find_charging_station mit lat ${lat}, lon ${lon}.`,
    asOf: "Stand",
  },
  en: {
    page: "Station page",
    category: (c: number) => `station category ${String(c)} (Bahnhofskategorie)`,
    stepFree: "Step-free now",
    stepFreeNeutral: "Step-free access",
    reachable: "step-free",
    reachableUnknown: "step-free per inventory, lift state unknown",
    blocked: "not step-free right now, lift out of service",
    stepless: { yes: "Step-free access per DB: yes", partial: "Step-free access per DB: partly", no: "Step-free access per DB: no" },
    lifts: "Lifts and escalators",
    kind: { elevator: "Lift", escalator: "Escalator", travelator: "Moving walkway", other: "Unit" },
    noLocation: "no location given",
    state: { inactive: "out of service", active: "working", unknown: "state unknown" },
    reason: "reason",
    back: "expected back",
    platforms: "Platforms",
    track: "Platform",
    facts: { yes: "step-free", partial: "partly step-free", no: "not step-free", unknown: "step-free access unknown" },
    height: (h: { readonly min: number; readonly max: number }) => `platform height ${h.min === h.max ? String(h.min) : `${String(h.min)}–${String(h.max)}`} cm`,
    departures: "Departures",
    cancelled: "cancelled",
    onTime: "on time",
    noForecast: "no delay figure",
    plan: "timetable only",
    instead: "instead of",
    replacement: "rail replacement",
    alerts: "Service alerts",
    here: "at the station",
    until: "until",
    linesWord: "lines",
    more: (n: number) => `… and ${String(n)} more`,
    ampel: "Rail lamp",
    lamp: { red: "Red", yellow: "Amber", green: "Green", unknown: "Grey" } as Record<Lamp, string>,
    ampelWhy: {
      late: (m: number, n: number, of: number) => `More than ${String(m)} min late: ${String(n)} of ${String(of)}`,
      cancelled: (n: number, of: number) => `Cancelled: ${String(n)} of ${String(of)}`,
      median: (m: number) => `Median delay: ${String(m)} min`,
      platform: (n: number) => `Platform changes: ${String(n)}`,
      alert: (n: number) => `Disruption notices: ${String(n)}`,
      sight: "Limited view: real-time data may be out of date",
      line: (l: string, lamp: string) => `Line ${l}: ${lamp}`,
      dep: "departures",
      arr: "arrivals",
      green: "Nothing reported by our sources – no guarantee",
      few: "Too few trips to judge",
      lines: "Lamp per line",
      long: "Long-distance",
    },
    parking: "Parking and charging",
    flags: { has_parking: "car park", has_bicycle_parking: "bicycle parking", has_car_rental: "car rental", has_taxi_rank: "taxi rank" } as Record<string, string>,
    perDb: "per DB",
    nearby: (lat: string, lon: string) => `Car parks and charging points nearby: find_parking or find_charging_station with lat ${lat}, lon ${lon}.`,
    asOf: "As of",
  },
} as const;

/** Today's share-alike subjects (get_train_departures'), and the alerts' (describe_station's). */
const SUBJECT = {
  siri: { de: "Die Echtzeitangaben aus DELFI SIRI ET", en: "The DELFI SIRI ET realtime entries" },
  both: { de: "Die Echtzeitangaben aus DELFI SIRI ET und DELFI GTFS-RT", en: "The DELFI SIRI ET and DELFI GTFS-RT realtime entries" },
  tu: { de: "Die Echtzeitangaben aus DELFI GTFS-RT", en: "The DELFI GTFS-RT realtime entries" },
  alerts: { de: "die DELFI-Störungsmeldungen", en: "the DELFI service alerts" },
  alertsAlone: { de: "Die DELFI-Störungsmeldungen", en: "The DELFI service alerts" },
} as const;

const stamp = (iso: string, language: Language, now: Date): string => `${W[language].asOf} ${standTime(iso, language, now)}`;

/** Today's platformLabel: the tracks a platform serves ("Platform 4/5"), else the inventory's name. */
export function platformLabel(p: { readonly tracks: readonly string[]; readonly name: string | null }, language: Language): string {
  return p.tracks.length > 0 ? `${W[language].track} ${p.tracks.join("/")}` : (p.name ?? W[language].track);
}

/** Today's liftLabel: DB's German words on a German answer, else the kind and tracks, else "no location given". */
export function liftLabel(u: T.StationPageLift, language: Language): string {
  const kinds: Readonly<Record<string, string>> = W[language].kind;
  const kind = kinds[u.kind] ?? W[language].kind.other;
  if (language === "de" && u.description !== null && u.description !== "") return `${kind} ${u.description}`;
  if (u.tracks.length > 0) return `${kind} (${W[language].track} ${u.tracks.join("/")})`;
  return `${kind} (${W[language].noLocation})`;
}

/** Today's departureLine. */
export function departureLine(r: T.StationPageDeparture, now: Date, language: Language): string {
  const w = W[language];
  const state = r.cancelled ? w.cancelled : r.delayMin !== null && r.delayMin !== 0 ? `${r.delayMin > 0 ? "+" : ""}${String(r.delayMin)} min` : r.delayMin === 0 ? w.onTime : r.noForecast ? w.noForecast : w.plan;
  const platform = r.platform === null ? "" : `, ${w.track} ${r.platform}${r.plannedPlatform === null ? "" : ` (${w.instead} ${r.plannedPlatform})`}`;
  const line = `${r.replacementBus ? `${w.replacement} ` : ""}${r.line ?? ""}`.trim();
  return `- ${standTime(r.planned, language, now)} ${line}${r.destination === null ? "" : ` → ${r.destination}`}${platform}: ${state}`;
}

/** Today's railReasonLine. */
export function railReasonLine(r: T.RailReason, language: Language): string {
  const w = W[language].ampelWhy;
  const side = (s: "dep" | "arr" | "both" | undefined): string => (s === undefined || s === "both" ? "" : ` (${s === "dep" ? w.dep : w.arr})`);
  switch (r.kind) {
    case "late": return w.late(LATE_OVER_MIN, r.n ?? 0, r.of ?? 0) + side(r.side);
    case "cancelled": return w.cancelled(r.n ?? 0, r.of ?? 0) + side(r.side);
    case "median": return w.median(r.min ?? 0);
    case "platform": return w.platform(r.n ?? 0);
    case "alert": return w.alert(r.n ?? 0);
    case "sight": return w.sight;
    case "line": return w.line(r.long === true ? w.long : (r.line ?? ""), W[language].lamp[r.lamp ?? "unknown"]);
  }
}

function listed<X>(items: readonly X[], line: (x: X) => string, language: Language): string[] {
  const shown = items.slice(0, LIST_SHOWN).map(line);
  return items.length > LIST_SHOWN ? [...shown, W[language].more(items.length - LIST_SHOWN)] : shown;
}

/** Today's shareAlikeSubjectOf: exactly the share-alike sections shown, the board's live figures, the alerts, or both. */
export function shareAlikeSubjectOf(page: NonNullable<T.StationPage>, language: Language): string | undefined {
  const board = page.sections.find((s) => s.id === "departures");
  const siri = board?.sources.includes("delfi_siri_et") === true;
  const tu = board?.sources.includes("delfi_rt_tu") === true;
  const alerts = page.sections.some((s) => s.id === "service_alerts" && (s.alerts ?? []).length > 0);
  const b = siri && tu ? SUBJECT.both : siri ? SUBJECT.siri : tu ? SUBJECT.tu : null;
  if (b === null) return alerts ? SUBJECT.alertsAlone[language] : undefined;
  return alerts ? `${b[language]} ${language === "de" ? "und" : "and"} ${SUBJECT.alerts[language]}` : b[language];
}

/** The page's sections in today's words, in the page's order. */
export function stationPageSectionsText(page: NonNullable<T.StationPage>, language: Language, now: Date): string {
  const w = W[language];
  const out: string[] = [];
  for (const s of page.sections) {
    switch (s.id) {
      case "header": {
        out.push(`${s.name ?? page.station.name} — ${w.page}: ${page.pageUrl}`);
        const address = [s.street ?? null, [s.zipcode ?? null, s.city ?? null].filter((x) => x !== null && x !== "").join(" ")].filter((x) => x !== null && x !== "").join(", ");
        const facts = [address, s.land ?? null, s.category === undefined || s.category === null ? null : w.category(s.category), s.evaNo === undefined || s.evaNo === null ? null : `EVA ${s.evaNo}`]
          .filter((x): x is string => x !== null && x !== "");
        if (facts.length > 0) out.push(facts.join(" · "));
        break;
      }
      case "rail_ampel": {
        const reasons = (s.reasons ?? []).map((x) => railReasonLine(x, language));
        const lamp = s.lamp ?? "unknown";
        const sentence = reasons.length > 0 ? reasons.join(" · ") : lamp === "green" ? w.ampelWhy.green : w.ampelWhy.few;
        out.push("", `${w.ampel}: ${w.lamp[lamp]} — ${sentence} (${stamp(s.asOf, language, now)})`);
        const lines = s.lines ?? [];
        if (lines.length > 0) out.push(`${w.ampelWhy.lines}: ${lines.map((l) => `${l.long ? w.ampelWhy.long : l.line} ${w.lamp[l.lamp]}`).join(", ")}`);
        break;
      }
      case "step_free_now": {
        const ok = s.platforms ?? [];
        const blocked = s.blocked ?? [];
        const confirmed = ok.filter((p) => p.lift !== "unknown");
        const unknownLift = ok.filter((p) => p.lift === "unknown");
        const label = (p: T.StationPagePlatform): string => platformLabel(p, language);
        out.push("", `${confirmed.length > 0 ? w.stepFree : w.stepFreeNeutral} (${stamp(s.asOf, language, now)}):`);
        if (confirmed.length > 0) out.push(`- ${w.reachable}: ${confirmed.map(label).join(", ")}`);
        if (unknownLift.length > 0) out.push(`- ${w.reachableUnknown}: ${unknownLift.map(label).join(", ")}`);
        if (blocked.length > 0) out.push(`- ${w.blocked}: ${blocked.map(label).join(", ")}`);
        const stepless = s.steplessAccess ?? null;
        if (ok.length === 0 && blocked.length === 0 && stepless !== null && stepless !== "unknown") out.push(`- ${w.stepless[stepless]}`);
        break;
      }
      case "lifts": {
        const units = s.units ?? [];
        if (units.length === 0) break;
        const liftLine = (u: T.StationPageLift): string => {
          const extra = [u.reason === null ? null : `${w.reason}: ${u.reason}`, u.resumeAt === null ? null : `${w.back} ${standTime(u.resumeAt, language, now)}`].filter((x): x is string => x !== null);
          return `- ${liftLabel(u, language)}: ${w.state[u.state]}${extra.length === 0 ? "" : ` (${extra.join("; ")})`}`;
        };
        out.push("", `${w.lifts} (${stamp(s.asOf, language, now)}):`, ...listed(units, liftLine, language));
        break;
      }
      case "platforms": {
        const platforms = s.platforms ?? [];
        if (platforms.length === 0) break;
        out.push("", `${w.platforms} (${stamp(s.asOf, language, now)}):`);
        out.push(...listed(platforms, (p) => `- ${platformLabel(p, language)}: ${w.facts[p.stepFree ?? "unknown"]}${p.heightCm === undefined || p.heightCm === null ? "" : `, ${w.height(p.heightCm)}`}`, language));
        break;
      }
      case "departures": {
        const rows = s.rows ?? [];
        if (rows.length === 0) break;
        out.push("", `${w.departures} (${stamp(s.asOf, language, now)}):`, ...rows.map((r) => departureLine(r, now, language)));
        break;
      }
      case "service_alerts": {
        const alerts = s.alerts ?? [];
        if (alerts.length === 0) break;
        const line = (m: T.StationPageAlert): string => {
          const where = m.atStation ? `${w.here}: ` : m.lines.length > 0 ? `${w.linesWord} ${m.lines.join(", ")}: ` : "";
          return `- ${where}${m.header}${m.until === null ? "" : ` (${w.until} ${standTime(m.until, language, now)})`}`;
        };
        out.push("", `${w.alerts} (${stamp(s.asOf, language, now)}):`, ...listed(alerts, line, language));
        break;
      }
      case "parking_charging": {
        const flags = s.facilities ?? [];
        const point = s.point ?? null;
        if (flags.length === 0 && point === null) break;
        out.push("", `${w.parking}:`);
        if (flags.length > 0) out.push(`- ${w.perDb}: ${flags.map((f) => w.flags[f] ?? f).join(", ")}`);
        if (point !== null) out.push(`- ${w.nearby(point.lat.toFixed(5), point.lon.toFixed(5))}`);
        break;
      }
      default:
        break;
    }
  }
  return out.join("\n");
}
