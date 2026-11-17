// Vendored from the ViaFrei platform (DB Timetables board, its parser and helpers); comments removed in the move.
import { planPathParts } from "./client.js";
import { log } from "../../log.js";
import { oneRowPerTrain } from "./one-departure.js";
import { parseTimetable, mergeDepartures, departuresInWindow, TimetableParseError, type Departure, type Timetable, type TimetableStop } from "./db-timetables.js";
export const MAX_PLAN_HOURS = 3;
export function planHours(from: Date, durationMin: number): Date[] {
    const until = from.getTime() + Math.max(0, durationMin) * 60_000;
    const out: Date[] = [];
    const seen = new Set<string>();
    const add = (ms: number): void => {
        const at = new Date(ms);
        const { date, hour } = planPathParts(at);
        const key = `${date}/${hour}`;
        if (seen.has(key))
            return;
        seen.add(key);
        out.push(at);
    };
    for (let t = from.getTime(); t < until; t += 3_600_000)
        add(t);
    add(until);
    return out;
}
export type BoardProgress = {
    readonly done: number;
    readonly total: number;
    readonly label: string;
};
export type BoardDeparture = Departure & {
    readonly evaNo: string;
    readonly stationPart: string | null;
    readonly alsoFiledAs?: readonly FiledAlsoAs[];
};
export type FiledAlsoAs = {
    readonly evaNo: string;
    readonly stationPart: string | null;
    readonly tripId: string;
};
export function oneFilingPerTrain(rows: readonly BoardDeparture[]): BoardDeparture[] {
    const weight = (d: BoardDeparture): number => (d.platform !== null ? 2 : 0) + (d.added ? 0 : 1);
    const { kept, twins } = oneRowPerTrain(rows, (d) => ({ line: d.line, destination: d.destination, at: d.plannedAt, cancelled: d.cancelled, rail: (d.category ?? "").trim().toUpperCase() !== "BUS", category: d.category, platform: d.platform }), weight);
    return kept.map((d) => {
        const also = twins.get(d);
        if (also === undefined)
            return d;
        return { ...d, alsoFiledAs: [...(d.alsoFiledAs ?? []), ...also.flatMap((t) => [{ evaNo: t.evaNo, stationPart: t.stationPart, tripId: t.tripId }, ...(t.alsoFiledAs ?? [])])] };
    });
}
export type BoardPart = {
    readonly evaNo: string;
    readonly station: string | null;
    readonly answered: boolean;
    readonly notServed?: true;
};
export type DepartureBoard = {
    readonly evaNo: string;
    readonly station: string | null;
    readonly parts: readonly BoardPart[];
    readonly departures: readonly BoardDeparture[];
    readonly degraded: boolean;
    readonly notes: readonly string[];
    readonly cacheHitRate: number | null;
    readonly calls: number;
    readonly hoursSkipped?: number;
    readonly inWindow?: number;
    readonly filteredOut?: number;
    readonly partFilter: "none" | "applied" | "unmatched";
    readonly publishedUntil?: Date;
};
export function oneTrainOnce<D extends {
    line: string;
    plannedAt: Date;
    destination: string | null;
    platform: string | null;
    delayMin: number;
    cancelled: boolean;
    platformChanged: boolean;
    category?: string | null;
}>(rows: readonly D[]): D[] {
    const keyOf = (d: D): string => `${d.line}\u0000${d.plannedAt.getTime()}\u0000${d.destination ?? ""}`;
    const weight = (d: D): number => (d.platform !== null ? 4 : 0) + (d.cancelled || d.platformChanged || d.delayMin !== 0 ? 2 : 0);
    const best = new Map<string, D>();
    for (const d of rows) {
        const k = keyOf(d);
        const held = best.get(k);
        if (held === undefined || weight(d) > weight(held))
            best.set(k, d);
    }
    const once = rows.filter((d) => best.get(keyOf(d)) === d);
    const lastWord = (line: string): string => line.trim().split(/\s+/).pop() ?? "";
    const twinKey = (d: D): string => `${lastWord(d.line)}\u0000${d.plannedAt.getTime()}`;
    const named = new Map<string, D[]>();
    for (const d of once)
        if (d.destination !== null)
            named.set(twinKey(d), [...(named.get(twinKey(d)) ?? []), d]);
    const addsNothing = (bare: D, twin: D): boolean => (!bare.cancelled || twin.cancelled) && (bare.delayMin === 0 || bare.delayMin === twin.delayMin) && (!bare.platformChanged || twin.platformChanged);
    const unbare = once.filter((d) => {
        if (d.destination !== null || (d.category ?? null) !== null)
            return true;
        const twins = named.get(twinKey(d)) ?? [];
        return !(twins.length === 1 && addsNothing(d, twins[0]!));
    });
    const sameStop = (d: D): string | null => (d.destination === null || d.platform === null ? null : `${d.plannedAt.getTime()}\u0000${d.destination}\u0000${d.platform}`);
    const sameFacts = (a: D, b: D): boolean => a.cancelled === b.cancelled && a.delayMin === b.delayMin && a.platformChanged === b.platformChanged;
    const first = new Map<string, D>();
    return unbare.filter((d) => {
        const k = sameStop(d);
        if (k === null)
            return true;
        const held = first.get(k);
        if (held === undefined) {
            first.set(k, d);
            return true;
        }
        return !sameFacts(held, d);
    });
}
export type BoardOptions = {
    readonly from: Date;
    readonly durationMin: number;
    readonly limit: number;
    readonly onProgress?: (p: BoardProgress) => void;
    readonly partFilter?: (station: string | null) => boolean;
    readonly keep?: (d: Departure) => boolean;
    readonly now?: Date;
};
export const PLAN_HORIZON_MIN_LEAD_H = 12;
export class PlanNotPublishedError extends Error {
    constructor(readonly evaNo: string, message: string) {
        super(message);
        this.name = "PlanNotPublishedError";
    }
}
export type TimetableSource = {
    plan(evaNo: string, at: Date): Promise<{
        body: string;
    }>;
    fullChanges(evaNo: string): Promise<{
        body: string;
    }>;
    cacheHitRate(): number | null;
};
export const MAX_BOARD_PARTS = 4;
const EMPTY: Timetable = { station: null, evaNo: null, stops: [] };
function isNotConfigured(err: unknown): boolean {
    return err instanceof Error && err.name === "DbApiError" && (err as {
        kind?: string;
    }).kind === "not_configured";
}
function dbApiKind(err: unknown): string | null {
    return err instanceof Error && err.name === "DbApiError" ? ((err as {
        kind?: string;
    }).kind ?? null) : null;
}
function noPlanError(failures: readonly unknown[], context: string): Error {
    const parse = failures.find((f) => f instanceof TimetableParseError);
    if (parse !== undefined)
        return new TimetableParseError(`${context}: ${parse.message}`);
    const limited = failures.find((f) => dbApiKind(f) === "rate_limited");
    if (limited !== undefined)
        return limited as Error;
    if (failures.length > 0 && failures.every((f) => dbApiKind(f) === "not_found"))
        return failures[0] as Error;
    const first = failures[0];
    return first instanceof Error ? first : new Error(`${context}: ${String(first)}`);
}
export async function fetchDepartureBoard(source: TimetableSource, eva: string | readonly string[], o: BoardOptions): Promise<DepartureBoard> {
    const distinct = [...new Set(typeof eva === "string" ? [eva] : eva)];
    const asked = distinct.slice(0, MAX_BOARD_PARTS);
    const evaNo = asked[0];
    if (evaNo === undefined)
        throw new TypeError("fetchDepartureBoard needs at least one EVA number");
    const wanted = planHours(o.from, o.durationMin);
    const hours = wanted.slice(0, MAX_PLAN_HOURS);
    const total = asked.length * (hours.length + 1);
    const multi = asked.length > 1;
    const notes: string[] = [];
    let degraded = false;
    if (distinct.length > asked.length) {
        const dropped = distinct.slice(MAX_BOARD_PARTS);
        degraded = true;
        notes.push(`station has ${distinct.length} EVA numbers, only the first ${MAX_BOARD_PARTS} were asked — departures of ${dropped.join(", ")} are not on this board`);
        log.warn({ evaNos: distinct, dropped, max: MAX_BOARD_PARTS }, "db-board: station has more EVA numbers than one board may ask; the rest were not asked");
    }
    if (wanted.length > hours.length) {
        degraded = true;
        notes.push(`window capped at ${MAX_PLAN_HOURS} plan hours — later departures are not on this board`);
    }
    let calls = 0;
    let done = 0;
    let skippedHours = 0;
    const failures: unknown[] = [];
    const where = (part: string): string => (multi ? ` (EVA ${part})` : "");
    type PartState = {
        readonly evaNo: string;
        station: string | null;
        readonly planStops: TimetableStop[];
        planned: number;
        readonly failures: unknown[];
        readonly notes: string[];
        changes: Timetable;
        changesAsked: boolean;
        changesNote: string | null;
        hourFailure: {
            readonly err: unknown;
        } | null;
        readonly answeredHours: number[];
        readonly failedHours: {
            readonly i: number;
            readonly err: unknown;
        }[];
    };
    const states: PartState[] = asked.map((evaNo) => ({ evaNo, station: null, planStops: [], planned: 0, failures: [], notes: [], changes: EMPTY, changesAsked: false, changesNote: null, hourFailure: null, answeredHours: [], failedHours: [] }));
    let aborted = false;
    const abort = (err: unknown): never => {
        aborted = true;
        throw err;
    };
    const askChanges = async (s: PartState): Promise<void> => {
        s.changesAsked = true;
        try {
            const res = await source.fullChanges(s.evaNo);
            calls++;
            s.changes = parseTimetable(res.body);
            s.station ??= s.changes.station;
        }
        catch (err) {
            if (isNotConfigured(err))
                abort(err);
            degraded = true;
            s.changesNote = `realtime changes${where(s.evaNo)} unavailable — times are the published plan`;
        }
        o.onProgress?.({ done: ++done, total, label: "changes" });
    };
    const askHour = async (s: PartState, i: number, at: Date): Promise<void> => {
        try {
            const res = await source.plan(s.evaNo, at);
            calls++;
            const parsed = parseTimetable(res.body);
            s.station ??= parsed.station;
            s.planStops.push(...parsed.stops);
            s.planned++;
            s.answeredHours.push(i);
        }
        catch (err) {
            if (isNotConfigured(err))
                abort(err);
            if (err instanceof TimetableParseError)
                calls++;
            s.hourFailure = { err };
            s.failures.push(err);
            s.failedHours.push({ i, err });
            s.notes.push(`plan hour ${i + 1} of ${hours.length}${where(s.evaNo)} ${err instanceof TimetableParseError ? "unreadable" : "unavailable"}`);
        }
        o.onProgress?.({ done: ++done, total, label: "plan" });
        if (s.planned > 0 && !s.changesAsked && !aborted)
            await askChanges(s);
    };
    const merged = (): {
        all: BoardDeparture[];
        kept: BoardDeparture[];
        unfiltered: BoardDeparture[];
        partFilter: DepartureBoard["partFilter"];
    } => {
        const all: BoardDeparture[] = [];
        for (const s of states) {
            if (s.planned === 0)
                continue;
            for (const d of mergeDepartures({ station: s.station, evaNo: s.evaNo, stops: s.planStops }, s.changes))
                all.push({ ...d, evaNo: s.evaNo, stationPart: multi ? s.station : null });
        }
        let partFilter: DepartureBoard["partFilter"] = "none";
        let kept = all;
        if (o.partFilter !== undefined) {
            const keep = new Set(states.filter((s) => s.planned > 0 && o.partFilter!(s.station)).map((s) => s.evaNo));
            partFilter = keep.size > 0 ? "applied" : "unmatched";
            if (keep.size > 0)
                kept = all.filter((d) => keep.has(d.evaNo));
        }
        kept.sort((a, b) => a.expectedAt.getTime() - b.expectedAt.getTime() || a.line.localeCompare(b.line, "de"));
        const once = oneFilingPerTrain(oneTrainOnce(kept)).sort((a, b) => a.expectedAt.getTime() - b.expectedAt.getTime() || a.line.localeCompare(b.line, "de"));
        return { all, kept: o.keep === undefined ? once : once.filter(o.keep), unfiltered: once, partFilter };
    };
    const enoughBefore = (boundary: number): boolean => {
        const backed = new Set(states.flatMap((s) => s.planStops.map((st) => `${s.evaNo} ${st.id}`)));
        const { kept, unfiltered } = merged();
        const first = departuresInWindow(kept, o.from, o.durationMin, o.limit);
        const last = first[first.length - 1];
        if (first.length < o.limit || last === undefined || last.expectedAt.getTime() >= boundary)
            return false;
        return !unfiltered.some((d) => !backed.has(`${d.evaNo} ${d.tripId}`) && d.expectedAt.getTime() < boundary && (d.cancelled || d.plannedAt.getTime() >= boundary));
    };
    for (const [i, at] of hours.entries()) {
        await Promise.all(states.map((s) => askHour(s, i, at)));
        for (const s of states) {
            if (s.hourFailure !== null)
                failures.push(s.hourFailure.err);
            if (s.changesNote !== null)
                notes.push(s.changesNote);
            s.hourFailure = null;
            s.changesNote = null;
        }
        const next = hours[i + 1];
        if (next === undefined)
            break;
        const nextHourStart = Math.floor(next.getTime() / 3_600_000) * 3_600_000;
        if (enoughBefore(nextHourStart)) {
            skippedHours = hours.length - (i + 1);
            break;
        }
    }
    const lastAnswered = Math.max(-1, ...states.flatMap((s) => s.answeredHours));
    const later = states.flatMap((s) => s.failedHours.filter((f) => f.i > lastAnswered));
    const firstLater = later.length === 0 ? undefined : hours[Math.min(...later.map((f) => f.i))];
    const hourOfMs = (d: Date): number => Math.floor(d.getTime() / 3_600_000);
    const horizonFrom = lastAnswered >= 0 && firstLater !== undefined && o.now !== undefined
        && later.every((f) => dbApiKind(f.err) === "not_found")
        && hourOfMs(firstLater) > hourOfMs(o.now) + PLAN_HORIZON_MIN_LEAD_H
        ? hourOfMs(firstLater) * 3_600_000
        : null;
    if (horizonFrom !== null) {
        log.info({ evaNos: asked, publishedUntil: new Date(horizonFrom).toISOString(), now: o.now?.toISOString() }, "db-board: the later plan hours of the window answered 404 after the earlier ones answered, past the minimum lead; DB has not published that far ahead, the board is not degraded for them");
    }
    const parts: BoardPart[] = [];
    for (const s of states) {
        const pastHorizon = horizonFrom !== null && s.planned > 0 && s.failedHours.length > 0 && s.failedHours.every((f) => f.i > lastAnswered);
        const notServed = multi && s.planned === 0 && s.failures.length > 0 && s.failures.every((f) => dbApiKind(f) === "not_found");
        if (notServed) {
            log.info({ evaNo: s.evaNo, station: asked }, "db-board: DB Timetables answers 404 for every hour of this StaDa EVA number; treated as not served, the board is not degraded");
        }
        else if (s.notes.length > 0 && !pastHorizon) {
            degraded = true;
            notes.push(...s.notes);
        }
        parts.push(s.planned === 0
            ? { evaNo: s.evaNo, station: s.station, answered: false, ...(notServed ? { notServed: true as const } : {}) }
            : { evaNo: s.evaNo, station: s.station, answered: true });
    }
    if (!parts.some((p) => p.answered)) {
        const err = noPlanError(failures, `no timetable could be read for station ${asked.join("/")} (${notes.join("; ")})`);
        const first = hours[0];
        const hourOf = (d: Date): number => Math.floor(d.getTime() / 3_600_000);
        if (dbApiKind(err) === "not_found" && o.now !== undefined && first !== undefined && hourOf(first) > hourOf(o.now)) {
            let carried = false;
            try {
                const res = await source.plan(evaNo, o.now);
                calls++;
                parseTimetable(res.body);
                carried = true;
            }
            catch (probe) {
                if (isNotConfigured(probe))
                    throw probe;
            }
            if (carried) {
                log.info({ evaNo, firstHour: first.toISOString(), now: o.now.toISOString() }, "db-board: every plan hour of a future window answered 404 while the current hour answers; DB has not published its plan that far ahead");
                throw new PlanNotPublishedError(evaNo, `DB Timetables has not published the plan of station ${asked.join("/")} for ${first.toISOString()} yet (the current hour answers)`);
            }
        }
        throw err;
    }
    const { kept, unfiltered, partFilter } = merged();
    const inWindow = departuresInWindow(kept, o.from, o.durationMin, Number.MAX_SAFE_INTEGER).length;
    return {
        evaNo,
        station: parts[0]?.station ?? null,
        parts,
        departures: departuresInWindow(kept, o.from, o.durationMin, o.limit),
        inWindow,
        ...(o.keep === undefined ? {} : { filteredOut: departuresInWindow(unfiltered, o.from, o.durationMin, Number.MAX_SAFE_INTEGER).length - inWindow }),
        degraded,
        notes,
        cacheHitRate: source.cacheHitRate(),
        calls,
        hoursSkipped: skippedHours,
        partFilter,
        ...(horizonFrom === null ? {} : { publishedUntil: new Date(horizonFrom) }),
    };
}
