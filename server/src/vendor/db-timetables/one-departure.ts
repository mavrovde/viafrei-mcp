// Vendored from the ViaFrei platform (DB Timetables board, its parser and helpers); comments removed in the move.
import { lineKey } from "./line-key.js";
import { differentDestinations } from "./destination.js";
import { normalizeName } from "./name-fold.js";
export const TWIN_WINDOW_MS = 2 * 60_000;
export function isRailRouteType(t: number | null): boolean {
    return t === 2 || (t !== null && t >= 100 && t <= 199);
}
export function railRouteTypeSql(column: string): string {
    return `(${column} = 2 or ${column} between 100 and 199)`;
}
export type TwinFacts = {
    readonly line: string | null;
    readonly destination: string | null;
    readonly at: Date;
    readonly cancelled: boolean;
    readonly rail: boolean;
    readonly platform?: string | null;
    readonly category?: string | null;
};
export function serviceKey(line: string | null): string | null {
    if (line === null)
        return null;
    const last = line.trim().split(/\s+/u).pop() ?? "";
    return lineKey(last);
}
export function lineFormKey(line: string | null): string | null {
    if (line === null)
        return null;
    return lineKey(line.replace(/\([^)]*\)|\[[^\]]*\]/gu, " "));
}
export function sameLine(a: string | null, b: string | null): boolean {
    const s = serviceKey(a);
    if (s !== null && s === serviceKey(b))
        return true;
    const f = lineFormKey(a);
    return f !== null && f === lineFormKey(b);
}
export function destinationKey(d: string | null): string | null {
    if (d === null)
        return null;
    const k = d
        .toLocaleLowerCase("de")
        .replace(/(^|[^\p{L}])hauptbahnhof(?!\p{L})/gu, "$1hbf")
        .replace(/(^|[^\p{L}])bahnhof(?!\p{L})/gu, "$1bf")
        .replace(/[^\p{L}\p{N}]+/gu, "");
    return k === "" ? null : k;
}
function samePlatform(a: TwinFacts, b: TwinFacts): boolean {
    const pa = a.platform?.trim() ?? "";
    const pb = b.platform?.trim() ?? "";
    return pa === "" || pb === "" || pa.toLowerCase() === pb.toLowerCase();
}
export function townWord(d: string | null): string | null {
    if (d === null)
        return null;
    const w = normalizeName(d).split(" ")[0] ?? "";
    return w.length >= 3 ? w : null;
}
function sameVehicle(a: TwinFacts, b: TwinFacts): boolean {
    if (a.at.getTime() !== b.at.getTime())
        return false;
    if (!samePlatform(a, b))
        return false;
    const da = destinationKey(a.destination);
    if (da !== null && da === destinationKey(b.destination))
        return true;
    const ta = townWord(a.destination);
    return ta !== null && ta === townWord(b.destination) && a.destination !== null && b.destination !== null && !differentDestinations(a.destination, b.destination);
}
export function areTwins(a: TwinFacts, b: TwinFacts): boolean {
    if (a.cancelled !== b.cancelled)
        return false;
    if (!a.rail || !b.rail) {
        if (a.rail || b.rail)
            return false;
        return sameLine(a.line, b.line) && sameVehicle(a, b);
    }
    if (!sameLine(a.line, b.line))
        return false;
    const dest = destinationKey(a.destination);
    if (dest === null || dest !== destinationKey(b.destination))
        return false;
    const ca = a.category?.trim().toUpperCase() ?? "";
    const cb = b.category?.trim().toUpperCase() ?? "";
    if (ca !== "" && cb !== "" && ca !== cb)
        return false;
    if (!samePlatform(a, b))
        return false;
    return Math.abs(a.at.getTime() - b.at.getTime()) <= TWIN_WINDOW_MS;
}
export function oneRowPerTrain<T>(rows: readonly T[], facts: (row: T) => TwinFacts, weight: (row: T) => number): {
    readonly kept: T[];
    readonly twins: ReadonlyMap<T, readonly T[]>;
} {
    const kept: T[] = [];
    const twins = new Map<T, T[]>();
    for (const row of rows) {
        const f = facts(row);
        const i = kept.findIndex((k) => areTwins(facts(k), f));
        if (i < 0) {
            kept.push(row);
            continue;
        }
        const held = kept[i]!;
        const absorbed = [...(twins.get(held) ?? [])];
        twins.delete(held);
        if (weight(row) > weight(held)) {
            kept[i] = row;
            twins.set(row, [...absorbed, held]);
        }
        else {
            twins.set(held, [...absorbed, row]);
        }
    }
    return { kept, twins };
}
