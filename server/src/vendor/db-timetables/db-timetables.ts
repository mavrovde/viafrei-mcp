// Vendored from the ViaFrei platform (DB Timetables board, its parser and helpers); comments removed in the move.
import { SaxesParser } from "saxes";
import { spacedStationName } from "./station-name.js";
import { berlinWallMsToInstant } from "./berlin-time.js";
export type StopEvent = {
    readonly plannedTime: string | null;
    readonly changedTime: string | null;
    readonly plannedPlatform: string | null;
    readonly changedPlatform: string | null;
    readonly plannedStatus: string | null;
    readonly changedStatus: string | null;
    readonly line: string | null;
    readonly plannedPath: readonly string[];
    readonly changedPath: readonly string[];
    readonly extras: Readonly<Record<string, string>>;
};
export type TripLabel = {
    readonly category: string | null;
    readonly number: string | null;
    readonly owner: string | null;
    readonly extras: Readonly<Record<string, string>>;
};
export type TimetableStop = {
    readonly id: string;
    readonly label: TripLabel | null;
    readonly arrival: StopEvent | null;
    readonly departure: StopEvent | null;
};
export type Timetable = {
    readonly station: string | null;
    readonly evaNo: string | null;
    readonly stops: readonly TimetableStop[];
};
export class TimetableParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TimetableParseError";
    }
}
const EVENT_MODELLED = new Set(["pt", "ct", "pp", "cp", "ps", "cs", "l", "ppth", "cpth"]);
const LABEL_MODELLED = new Set(["c", "n", "o"]);
function splitPath(value: string | undefined): string[] {
    if (value === undefined || value.trim() === "")
        return [];
    return value.split("|").map((s) => spacedStationName(s.trim())).filter((s) => s !== "");
}
function present(value: string | undefined): string | null {
    return value === undefined || value.trim() === "" ? null : value.trim();
}
function eventFrom(attrs: Record<string, string>): StopEvent {
    const extras: Record<string, string> = {};
    for (const [k, v] of Object.entries(attrs))
        if (!EVENT_MODELLED.has(k))
            extras[k] = v;
    return {
        plannedTime: attrs["pt"] ?? null,
        changedTime: attrs["ct"] ?? null,
        plannedPlatform: present(attrs["pp"]),
        changedPlatform: present(attrs["cp"]),
        plannedStatus: attrs["ps"] ?? null,
        changedStatus: attrs["cs"] ?? null,
        line: present(attrs["l"]),
        plannedPath: splitPath(attrs["ppth"]),
        changedPath: splitPath(attrs["cpth"]),
        extras,
    };
}
export function parseTimetable(xml: string): Timetable {
    const parser = new SaxesParser();
    let station: string | null = null;
    let evaNo: string | null = null;
    const stops: TimetableStop[] = [];
    let current: {
        id: string;
        label: TripLabel | null;
        arrival: StopEvent | null;
        departure: StopEvent | null;
    } | null = null;
    let failure: string | null = null;
    let root: string | null = null;
    parser.on("error", (e: Error) => { failure ??= e.message; });
    parser.on("opentag", (tag) => {
        const attrs = tag.attributes as Record<string, string>;
        root ??= tag.name;
        switch (tag.name) {
            case "timetable":
                station = attrs["station"] === undefined ? null : spacedStationName(attrs["station"]);
                evaNo = attrs["eva"] ?? null;
                break;
            case "s":
                current = attrs["id"] === undefined ? null : { id: attrs["id"], label: null, arrival: null, departure: null };
                break;
            case "tl":
                if (current !== null) {
                    const extras: Record<string, string> = {};
                    for (const [k, v] of Object.entries(attrs))
                        if (!LABEL_MODELLED.has(k))
                            extras[k] = v;
                    current.label = { category: present(attrs["c"]), number: present(attrs["n"]), owner: present(attrs["o"]), extras };
                }
                break;
            case "ar":
                if (current !== null)
                    current.arrival = eventFrom(attrs);
                break;
            case "dp":
                if (current !== null)
                    current.departure = eventFrom(attrs);
                break;
            default:
                break;
        }
    });
    parser.on("closetag", (tag) => {
        if (tag.name === "s" && current !== null) {
            stops.push(current);
            current = null;
        }
    });
    parser.write(xml);
    parser.close();
    if (failure !== null)
        throw new TimetableParseError(`DB Timetables XML is not well formed: ${String(failure)}`);
    if (String(root) !== "timetable")
        throw new TimetableParseError(`the root element is <${String(root)}>, not <timetable> — is this a DB Timetables response?`);
    return { station, evaNo, stops };
}
export function parseIrisTime(value: string | null | undefined): Date | null {
    if (typeof value !== "string")
        return null;
    const m = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(value.trim());
    if (m === null)
        return null;
    const [, yy, mm, dd, hh, mi] = m;
    return berlinMinuteToInstant(2_000 + Number(yy), Number(mm), Number(dd), Number(hh), Number(mi));
}
export function berlinMinuteToInstant(year: number, month: number, day: number, hour: number, minute: number): Date | null {
    const wall = Date.UTC(year, month - 1, day, hour, minute);
    if (!Number.isFinite(wall))
        return null;
    const at = berlinWallMsToInstant(wall, { fold: "later", gap: "shift" });
    return Number.isNaN(at.getTime()) ? null : at;
}
export type Departure = {
    readonly tripId: string;
    readonly line: string;
    readonly category: string | null;
    readonly destination: string | null;
    readonly via: readonly string[];
    readonly plannedAt: Date;
    readonly expectedAt: Date;
    readonly delayMin: number;
    readonly plannedPlatform: string | null;
    readonly platform: string | null;
    readonly platformChanged: boolean;
    readonly cancelled: boolean;
    readonly added: boolean;
};
function labelFor(stop: TimetableStop, event: StopEvent): string {
    const category = stop.label?.category ?? null;
    const number = event.line ?? stop.label?.number ?? null;
    const ownType = event.line !== null && /^\p{L}+\s?\d/u.test(event.line.trim()) && (category ?? "").trim().toUpperCase() !== "BUS";
    if (ownType)
        return event.line.trim();
    return [category, number].filter((s): s is string => s !== null && s !== "").join(" ") || "Zug";
}
function pathOf(event: StopEvent): readonly string[] {
    return event.changedPath.length > 0 ? event.changedPath : event.plannedPath;
}
export function mergeDepartures(plan: Timetable, changes: Timetable): Departure[] {
    const changeById = new Map<string, TimetableStop>();
    for (const s of changes.stops)
        changeById.set(s.id, s);
    const out: Departure[] = [];
    const seen = new Set<string>();
    const build = (base: TimetableStop, change: TimetableStop | undefined): Departure | null => {
        const planned = base.departure;
        const changed = change?.departure ?? null;
        if (planned === null && changed === null)
            return null;
        const event = planned ?? changed!;
        const changedAt = parseIrisTime(changed?.changedTime ?? planned?.changedTime ?? null);
        const plannedAt = parseIrisTime(planned?.plannedTime ?? changed?.plannedTime ?? null) ?? changedAt;
        const expectedAt = changedAt ?? plannedAt;
        if (plannedAt === null || expectedAt === null)
            return null;
        const status = changed?.changedStatus ?? planned?.changedStatus ?? null;
        const plannedStatus = planned?.plannedStatus ?? changed?.plannedStatus ?? null;
        const plannedPlatform = planned?.plannedPlatform ?? changed?.plannedPlatform ?? null;
        const changedPlatform = changed?.changedPlatform ?? planned?.changedPlatform ?? null;
        const label: TripLabel | null = base.label === null && (change?.label ?? null) === null
            ? null
            : {
                category: change?.label?.category ?? base.label?.category ?? null,
                number: change?.label?.number ?? base.label?.number ?? null,
                owner: change?.label?.owner ?? base.label?.owner ?? null,
                extras: { ...(base.label?.extras ?? {}), ...(change?.label?.extras ?? {}) },
            };
        const source: TimetableStop = { id: base.id, label, arrival: base.arrival, departure: event };
        const pathEvent = (planned !== null && pathOf(planned).length > 0) ? planned : (changed ?? planned!);
        const path = pathOf(pathEvent);
        return {
            tripId: base.id,
            line: labelFor(source, event),
            category: label?.category ?? null,
            destination: path.length > 0 ? path[path.length - 1]! : null,
            via: path.slice(0, -1),
            plannedAt,
            expectedAt,
            delayMin: Math.round((expectedAt.getTime() - plannedAt.getTime()) / 60_000),
            plannedPlatform,
            platform: changedPlatform ?? plannedPlatform,
            platformChanged: changedPlatform !== null && plannedPlatform !== null && changedPlatform !== plannedPlatform,
            cancelled: status === "c",
            added: status === "a" || plannedStatus === "a",
        };
    };
    for (const stop of plan.stops) {
        if (seen.has(stop.id))
            continue;
        seen.add(stop.id);
        const d = build(stop, changeById.get(stop.id));
        if (d !== null)
            out.push(d);
    }
    for (const stop of changes.stops) {
        if (seen.has(stop.id))
            continue;
        const d = build(stop, stop);
        if (d !== null)
            out.push(d);
    }
    out.sort((a, b) => a.expectedAt.getTime() - b.expectedAt.getTime() || a.line.localeCompare(b.line, "de"));
    return out;
}
export function departuresInWindow<D extends Departure>(departures: readonly D[], from: Date, durationMin: number, limit: number): D[] {
    const until = from.getTime() + durationMin * 60_000;
    return departures
        .filter((d) => {
        const at = (d.cancelled ? d.plannedAt : d.expectedAt).getTime();
        return at >= from.getTime() && at <= until;
    })
        .slice(0, limit);
}
