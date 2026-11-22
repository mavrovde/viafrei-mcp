/**
 * get_train_departures: a DB railway station's live board, through the API. The station's EVA numbers come
 * from the API's station search (Station.eva, Station.evaNumbers; an `eva_no` asks that number alone). For
 * each number the server asks the API's live refresher for a fresh board (createRefresh, source
 * train-board-de, subject {eva}), waits a short bounded time for the refresh to settle (getRefresh), and
 * answers from the board the API then holds (getTrainBoard). A board that is not fresh is never shown as
 * current: the answer says when the newest board held was fetched. A stop that is no DB station has no EVA
 * number; its board is the API's own departure board (listStationDepartures).
 *
 * structuredContent keeps the server's earlier shape: station, evaNo, evaNos, windowMin, categories when asked,
 * and departures (line, category, destination, plannedAt, expectedAt, delayMin, platform, plannedPlatform,
 * platformChanged, cancelled); a board that is not current lists none and says
 * `dbTimetables: { answered: false, reason: "unavailable" }`.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ApiError, type DataMeta, type Envelope } from "../api/client.js";
import type * as T from "../api/types.js";
import { log, redact } from "../log.js";
import { berlinDateTime, berlinTime, toolError, toolResult, type Language } from "../presentation.js";
import { num, str, strs, type Handler, type ToolContext } from "./context.js";

/** The live source of the API's refresher that fetches DB Timetables boards. */
export const TRAIN_BOARD_SOURCE = "train-board-de";
/** At most this many parts of a station are asked (a station of several parts files its trains under each). */
export const MAX_BOARD_PARTS = 4;

/** How long a tool call waits for a refresh to settle, and how often it asks again. */
export type RefreshWait = { readonly totalMs: number; readonly pollMs: number };
export const REFRESH_WAIT: RefreshWait = { totalMs: 3_000, pollMs: 250 };

const L = (language: Language, de: string, en: string): string => (language === "de" ? de : en);

/** How one refresh ended, as far as this call saw it. */
type Outcome = "settled" | "failed" | "timed_out" | "not_asked";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const failureOf = (err: unknown): { error: string; reason: string } => ({ error: err instanceof ApiError ? err.kind : "error", reason: redact(String(err)) });

/**
 * Asks the refresher for a fresh board of one EVA number and waits until the refresh settles or the wait is
 * spent. A 400 (the refresher refuses the number) and a 429 are the caller's to answer, so they are thrown;
 * any other refusal of the ask (scope, a switched-off source, an API that does not answer) leaves the board
 * to be read as the API holds it.
 */
async function refresh(ctx: ToolContext, eva: string): Promise<Outcome> {
  let r: Envelope<T.RefreshData>;
  try {
    r = await ctx.api.post<T.RefreshData>("createRefresh", { source: TRAIN_BOARD_SOURCE, subject: { eva } });
  } catch (err) {
    if (err instanceof ApiError && (err.kind === "invalid" || err.kind === "rate_limited")) throw err;
    log.warn({ eva, ...failureOf(err) }, "train board refresh not asked");
    return "not_asked";
  }
  const deadline = Date.now() + ctx.refreshWait.totalMs;
  let data = r.data;
  while (data.state === "pending" && Date.now() < deadline) {
    await sleep(Math.min(ctx.refreshWait.pollMs, Math.max(0, deadline - Date.now())));
    try {
      data = (await ctx.api.get<T.RefreshData>("getRefresh", { id: data.id })).data;
    } catch (err) {
      log.warn({ eva, ...failureOf(err) }, "train board refresh not read again");
      return "timed_out";
    }
  }
  if (data.state === "pending") return "timed_out";
  if (data.state === "failed" || data.state === "refused") {
    log.warn({ eva, state: data.state, reason: data.reason === null ? null : redact(data.reason) }, "train board refresh did not refresh");
    return "failed";
  }
  return "settled";
}

type Part = { eva: string; outcome: Outcome; board: Envelope<T.TrainBoardData> };

async function part(ctx: ToolContext, eva: string): Promise<Part> {
  const outcome = await refresh(ctx, eva);
  const board = await ctx.api.get<T.TrainBoardData>("getTrainBoard", { eva });
  return { eva, outcome, board };
}

const lineOf = (d: T.TrainBoardDeparture): string => d.line ?? ([d.category, d.number].filter((x) => x !== null && x !== "").join(" ") || "?");

/** One departure of a DB board in structuredContent. */
const departureStructured = (d: T.TrainBoardDeparture): Record<string, unknown> => ({
  line: lineOf(d), category: d.category, destination: d.destination, plannedAt: d.plannedAt, expectedAt: d.expectedAt, delayMin: d.delayMin,
  platform: d.platform, plannedPlatform: d.plannedPlatform, platformChanged: d.platformChanged, cancelled: d.cancelled,
});

const berlinDay = (d: Date): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** Always with the day: "18.09. 08:05" / "2026-09-18 08:05" (main presentation/format.ts berlinDatedTime). */
function datedClock(iso: string, language: Language): string {
  const dd = berlinDay(new Date(iso));
  return `${language === "de" ? `${dd.slice(8, 10)}.${dd.slice(5, 7)}.` : dd} ${berlinTime(iso)}`;
}

/** "08:05" on the day of `now`, the dated form on another (main berlinTime). */
const clockAt = (iso: string, now: Date, language: Language): string => (berlinDay(new Date(iso)) === berlinDay(now) ? berlinTime(iso) : datedClock(iso, language));

/** Today's server's words for a DB board (main get_train_departures.ts COPY, get_train_departures.schema.ts). */
const COPY = {
  de: {
    needStation: 'Bitte station (Bahnhofsname als Freitext) oder eva_no angeben. Hat die Person keinen Bahnhof genannt, bitte fragen, welchen. Zum Beispiel {"station": "Hannover Hbf"}.',
    head: (station: string, window: string) => `Abfahrten ab ${station} (${window}):`,
    headOfType: (station: string, window: string, types: string) => `Abfahrten ab ${station} (${window}, nur ${types}):`,
    nextMinutes: (n: number) => `nächste ${n} Minuten`,
    windowFromTo: (from: string, to: string) => `${from} bis ${to}`,
    withinNext: (n: number) => `in den nächsten ${n} Minuten`,
    withinSpan: (from: string, to: string) => `zwischen ${from} und ${to}`,
    empty: (station: string, within: string) => `Ab ${station} fährt ${within} kein Zug ab.`,
    emptyOfType: (station: string, within: string, types: string) => `Ab ${station} fährt ${within} kein Zug der Art ${types} ab.`,
    capped: (more: number, until: string, limit: number, max: number) =>
      `… und mindestens ${more} weitere bis ${until} — die Tafel zeigt die ersten ${limit}${limit < max ? `; mit limit bis ${max} mehr` : ""}, oder mit when ab einer späteren Zeit.`,
    stationRead: (station: string, eva: string) => `Abgefragt habe ich den Bahnhof ${station} (Bahnhofsnummer ${eva}).`,
    noDestination: "Ziel nicht angegeben",
    platform: (p: string) => `Gleis ${p}`,
    platformChanged: (now: string, was: string) => `Gleis ${now} (statt ${was})`,
    cancelled: "fällt aus",
    onTime: "pünktlich",
    expected: "ca.",
    unavailable: "Die Bahn-Daten sind gerade nicht vollständig erreichbar.",
  },
  en: {
    needStation: 'Give a station name (free text) or an eva_no. If the person named no station, ask which one. For example {"station": "Hannover Hbf"}.',
    head: (station: string, window: string) => `Departures from ${station} (${window}):`,
    headOfType: (station: string, window: string, types: string) => `Departures from ${station} (${window}, ${types} only):`,
    nextMinutes: (n: number) => `next ${n} minutes`,
    windowFromTo: (from: string, to: string) => `${from} to ${to}`,
    withinNext: (n: number) => `in the next ${n} minutes`,
    withinSpan: (from: string, to: string) => `between ${from} and ${to}`,
    empty: (station: string, within: string) => `No train leaves ${station} ${within}.`,
    emptyOfType: (station: string, within: string, types: string) => `No ${types} train leaves ${station} ${within}.`,
    capped: (more: number, until: string, limit: number, max: number) =>
      `… and at least ${more} more until ${until} — the board shows the first ${limit}${limit < max ? `; raise limit up to ${max} for more` : ""}, or set when to a later time.`,
    stationRead: (station: string, eva: string) => `Station asked: ${station} (station number ${eva}).`,
    noDestination: "destination not given",
    platform: (p: string) => `platform ${p}`,
    platformChanged: (now: string, was: string) => `platform ${now} (instead of ${was})`,
    cancelled: "cancelled",
    onTime: "on time",
    expected: "expected",
    unavailable: "The railway data is not fully reachable right now.",
  },
} as const;

/** Today's largest board (MAX_DEPARTURES), named by the capped line's "limit up to". */
const MAX_DEPARTURES = 15;

/** The asked train types as the answer names them: "ICE, IC" / "ICE/IC" (main typesOf). */
function typesOf(categories: readonly string[], language: Language): string {
  const list = categories.join(language === "de" ? ", " : "/");
  return categories.includes("IC") ? `${list} ${language === "de" ? "(IC mit EC, RJ, NJ, EN, TGV)" : "(IC including EC, RJ, NJ, EN, TGV)"}` : list;
}

/** "18:42 ICE 594 → Berlin Hbf, Gleis 7, +12 min (ca. 18:54)": planned time first, then the track, then the state. */
function departureLine(d: T.TrainBoardDeparture, language: Language, now: Date): string {
  const c = COPY[language];
  const parts: string[] = [];
  if (d.platform !== null) parts.push(d.platformChanged && d.plannedPlatform !== null ? c.platformChanged(d.platform, d.plannedPlatform) : c.platform(d.platform));
  if (d.cancelled) parts.push(c.cancelled);
  else if (d.delayMin > 0) parts.push(`+${d.delayMin} min (${c.expected} ${clockAt(d.expectedAt, now, language)})`);
  else parts.push(c.onTime);
  return `${clockAt(d.plannedAt, now, language)} ${lineOf(d)} → ${d.destination ?? c.noDestination}, ${parts.join(", ")}`;
}

/** The sentence a board that is not fresh gets: when the newest board held was fetched, or that none is. */
function staleLine(station: string, b: T.TrainBoardData, outcome: Outcome, language: Language): string {
  const age = b.ageSeconds === null ? "" : L(language, ` (vor ${Math.round(b.ageSeconds / 60)} min)`, ` (${Math.round(b.ageSeconds / 60)} min ago)`);
  const held =
    b.fetchedAt === null
      ? L(language, "es liegt noch keine vor.", "none is held yet.")
      : L(language, `die neueste ist vom ${berlinDateTime(b.fetchedAt, language)}${age}.`, `the newest held was fetched at ${berlinDateTime(b.fetchedAt, language)}${age}.`);
  const why =
    outcome === "failed"
      ? L(language, " Die Live-Abfahrten der DB sind gerade nicht erreichbar.", " DB's live departures are not reachable right now.")
      : outcome === "timed_out"
        ? L(language, " Die Aktualisierung läuft noch – bitte gleich noch einmal fragen.", " The refresh is still running – please ask again in a moment.")
        : "";
  return `${L(language, `Für ${station} liegt gerade keine aktuelle Abfahrtstafel der DB vor; `, `There is no current DB departure board for ${station} right now; `)}${held}${why}`;
}

async function liveBoard(evas: readonly string[], stationName: string | null, args: Record<string, unknown>, ctx: ToolContext, metas: DataMeta[]): Promise<CallToolResult> {
  const { language } = ctx;
  const limit = num(args["limit"]) ?? 10;
  const categories = strs(args["categories"]);
  const when = str(args["when"]);
  const from = when === undefined ? new Date() : new Date(when);
  if (Number.isNaN(from.getTime())) return toolError(L(language, "when ist keine gültige Zeit.", "when is not a valid time."));
  const windowMin = num(args["duration_min"]) ?? 60;
  const until = from.getTime() + windowMin * 60_000;
  const asked = evas.slice(0, MAX_BOARD_PARTS);
  const station = stationName ?? asked.join(", ");
  const head = { station, evaNo: asked[0], evaNos: asked, windowMin, ...(categories === undefined ? {} : { categories: [...categories] }) };

  let parts: Part[];
  try {
    parts = await Promise.all(asked.map((eva) => part(ctx, eva)));
  } catch (err) {
    if (err instanceof ApiError && err.kind === "invalid") {
      return toolError(L(language, `Die DB-Fahrplanschnittstelle kennt keinen Bahnhof mit der Nummer ${asked.join(", ")}. Bitte den Bahnhofsnamen nennen.`, `The DB timetable interface knows no station with the number ${asked.join(", ")}. Please give the station's name.`));
    }
    throw err;
  }

  const fresh = parts.filter((p) => p.board.data.fresh);
  if (fresh.length === 0) {
    const newest = parts.reduce((a, b) => ((b.board.data.fetchedAt ?? "") > (a.board.data.fetchedAt ?? "") ? b : a));
    const outcome: Outcome = parts.some((p) => p.outcome === "timed_out") ? "timed_out" : parts.every((p) => p.outcome === "failed") ? "failed" : newest.outcome;
    const text = staleLine(station, newest.board.data, outcome, language);
    if (outcome === "failed") return toolError(text);
    return toolResult(text, [...metas, { ...newest.board.meta, asOf: newest.board.data.fetchedAt }], language, {
      structured: { ...head, departures: [], dbTimetables: { answered: false, reason: "unavailable" } },
    });
  }

  const seen = new Set<string>();
  const inWindow = fresh
    .flatMap((p) => p.board.data.departures)
    .filter((d) => {
      const at = new Date(d.cancelled ? d.plannedAt : d.expectedAt).getTime();
      return at >= from.getTime() && at <= until && (categories === undefined || (d.category !== null && categories.includes(d.category)));
    })
    .filter((d) => {
      const key = `${lineOf(d)}\u0000${d.plannedAt}\u0000${d.destination ?? ""}`;
      return seen.has(key) ? false : (seen.add(key), true);
    })
    .sort((a, b) => a.plannedAt.localeCompare(b.plannedAt) || a.expectedAt.localeCompare(b.expectedAt));
  const rows = inWindow.slice(0, limit);
  const c = COPY[language];
  const now = new Date();
  const end = new Date(until).toISOString();
  const windowText = when === undefined ? c.nextMinutes(windowMin) : c.windowFromTo(datedClock(from.toISOString(), language), clockAt(end, from, language));
  const within = when === undefined ? c.withinNext(windowMin) : c.withinSpan(datedClock(from.toISOString(), language), clockAt(end, from, language));
  const types = categories === undefined ? null : typesOf(categories, language);
  const lines: string[] = [];
  if (rows.length === 0) {
    // Today's empty board names the station asked, by its number. Today's DELFI timetable reading beside it (a
    // train the timetable plans that DB does not carry) is not in the contract: api-gap.md, lane A.
    lines.push(types === null ? c.empty(station, within) : c.emptyOfType(station, within, types), c.stationRead(station, asked[0]!));
  } else {
    lines.push(types === null ? c.head(station, windowText) : c.headOfType(station, windowText, types), ...rows.map((d) => departureLine(d, language, now)));
    // A capped board says so. The board holds only the hours the API fetched, so the count is a floor.
    if (inWindow.length > rows.length) lines.push(c.capped(inWindow.length - rows.length, clockAt(end, now, language), limit, MAX_DEPARTURES));
  }
  // A part not current leaves the board incomplete: today's note, after the credit line. A number no board was
  // ever held for, and whose refresh did not fail, is one DB does not file trains under: today says nothing of it.
  const degraded = parts.some((p) => !p.board.data.fresh && (p.outcome === "failed" || p.board.data.fetchedAt !== null));
  const oldest = fresh.map((p) => p.board.data.fetchedAt).filter((x): x is string => x !== null).sort()[0] ?? null;
  return toolResult(lines.join("\n"), [...metas, { ...fresh[0]!.board.meta, asOf: oldest }], language, {
    structured: { ...head, departures: rows.map(departureStructured) },
    ...(degraded ? { note: c.unavailable } : {}),
  });
}

export const getTrainDepartures: Handler = async (args, ctx) => {
  const { language } = ctx;
  const eva = str(args["eva_no"]);
  const name = str(args["station"]);
  if (eva === undefined && name === undefined) return toolError(COPY[language].needStation);
  const stations = await ctx.api.get<T.Station[]>("listStations", { code: eva, q: eva === undefined ? name : undefined, limit: 1 });
  const station = stations.data[0];
  if (eva !== undefined) return liveBoard([eva], station?.name ?? null, args, ctx, [stations.meta]);
  if (station === undefined) {
    const q = name ?? "";
    return toolError(L(language, `Den Bahnhof "${q}" kenne ich nicht. Bitte den Namen so nennen, wie er am Bahnhof steht (z. B. "Hamburg Hbf", "Köln Hbf").`, `I do not know a station called "${q}". Please give the name as it appears at the station (e.g. "Hamburg Hbf", "Köln Hbf").`));
  }
  const evas = station.evaNumbers.length > 0 ? station.evaNumbers : station.eva === null ? [] : [station.eva];
  if (evas.length > 0) return liveBoard(evas, station.name, args, ctx, [stations.meta]);
  const r = await ctx.api.get<T.Board>("listStationDepartures", {
    stationId: station.id, from: str(args["when"]), duration_min: num(args["duration_min"]), categories: strs(args["categories"]), modes: ["rail"], limit: num(args["limit"]),
  });
  const rows = r.data.departures.map((d) => `- ${berlinTime(d.plannedAt)} ${d.line ?? d.category ?? ""} → ${d.destination ?? "?"}${d.cancelled ? L(language, " · fällt aus", " · cancelled") : d.delayMin ? ` · +${d.delayMin}` : ""}${d.platform === null ? "" : `${L(language, " · Gl. ", " · pl. ")}${d.platform}`}`);
  const body = rows.length === 0 ? `${r.data.station.name}: ${L(language, "keine Abfahrten im Zeitfenster.", "no departures in the window.")}` : [`${r.data.station.name}:`, ...rows].join("\n");
  const categories = strs(args["categories"]);
  return toolResult(body, [stations.meta, r.meta], language, {
    structured: {
      station: r.data.station.name, evaNo: null, evaNos: [], windowMin: num(args["duration_min"]) ?? 60, ...(categories === undefined ? {} : { categories: [...categories] }),
      departures: r.data.departures.map((d) => ({
        line: d.line ?? d.category, category: d.category, destination: d.destination, plannedAt: d.plannedAt, expectedAt: d.expectedAt, delayMin: d.delayMin,
        platform: d.platform, plannedPlatform: d.plannedPlatform, platformChanged: d.platformChanged, cancelled: d.cancelled,
      })),
    },
  });
};
