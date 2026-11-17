// Vendored from the ViaFrei platform (DB Timetables board, its parser and helpers); comments removed in the move.
import { zoneOffsetMs } from "./wall-clock.js";
export const BERLIN = "Europe/Berlin";
export type BerlinDay = string & {
    readonly __day: unique symbol;
};
const DAY_MS = 86_400_000;
const msOf = (at: Date | number): number => (typeof at === "number" ? at : at.getTime());
export function berlinOffsetMs(at: Date | number): number {
    return zoneOffsetMs(BERLIN, msOf(at));
}
function shifted(at: Date | number): Date {
    const ms = msOf(at);
    return new Date(ms + berlinOffsetMs(ms));
}
export function berlinDay(at: Date | number): BerlinDay {
    return shifted(at).toISOString().slice(0, 10) as BerlinDay;
}
export type BerlinWallClock = {
    readonly day: BerlinDay;
    readonly hour: number;
    readonly minute: number;
    readonly second: number;
    readonly weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
};
export function berlinWallClock(at: Date | number): BerlinWallClock {
    const s = shifted(at);
    const wd = s.getUTCDay();
    return {
        day: s.toISOString().slice(0, 10) as BerlinDay,
        hour: s.getUTCHours(),
        minute: s.getUTCMinutes(),
        second: s.getUTCSeconds(),
        weekday: (wd === 0 ? 7 : wd) as BerlinWallClock["weekday"],
    };
}
export function parseBerlinDay(s: string): BerlinDay | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return null;
    const utc = Date.parse(`${s}T00:00:00Z`);
    if (Number.isNaN(utc) || new Date(utc).toISOString().slice(0, 10) !== s)
        return null;
    return s as BerlinDay;
}
export type BerlinToInstantOptions = {
    readonly fold?: "earlier" | "later";
    readonly gap?: "after" | "shift";
};
export function berlinWallMsToInstant(wallMs: number, opts: BerlinToInstantOptions = {}): Date {
    const before = berlinOffsetMs(wallMs - DAY_MS);
    const after = berlinOffsetMs(wallMs + DAY_MS);
    const valid = [...new Set([before, after])]
        .map((offset) => wallMs - offset)
        .filter((instant) => instant + berlinOffsetMs(instant) === wallMs)
        .sort((a, b) => a - b);
    if (valid.length > 0)
        return new Date(((opts.fold ?? "earlier") === "later" ? valid[valid.length - 1] : valid[0]) as number);
    if (opts.gap === "shift")
        return new Date(wallMs - before);
    let lo = Math.floor((wallMs - Math.max(before, after)) / 1000);
    let hi = Math.ceil((wallMs - Math.min(before, after)) / 1000);
    while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (mid * 1000 + berlinOffsetMs(mid * 1000) >= wallMs)
            hi = mid;
        else
            lo = mid;
    }
    return new Date(hi * 1000);
}
export function berlinToInstant(day: BerlinDay | string, h: number, m: number, s = 0, opts: BerlinToInstantOptions = {}): Date {
    const y = Number(day.slice(0, 4));
    const mo = Number(day.slice(5, 7));
    const d = Number(day.slice(8, 10));
    return berlinWallMsToInstant(Date.UTC(y, mo - 1, d, h, m, s), opts);
}
export type BerlinStampFields = {
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly hour: number;
    readonly minute: number;
    readonly second?: number;
};
export type BerlinStampOptions = {
    readonly readAt?: Date | number;
    readonly skewMs?: number;
};
export const BERLIN_STAMP_SKEW_MS = 300000;
export function berlinStampToInstant(f: BerlinStampFields, opts: BerlinStampOptions = {}): Date | null {
    const second = f.second ?? 0;
    const wall = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, second);
    if (!Number.isFinite(wall))
        return null;
    const back = new Date(wall);
    if (back.getUTCFullYear() !== f.year || back.getUTCMonth() !== f.month - 1 || back.getUTCDate() !== f.day ||
        back.getUTCHours() !== f.hour || back.getUTCMinutes() !== f.minute || back.getUTCSeconds() !== second)
        return null;
    const earlier = berlinWallMsToInstant(wall, { fold: "earlier", gap: "shift" }).getTime();
    const later = berlinWallMsToInstant(wall, { fold: "later", gap: "shift" }).getTime();
    if (earlier === later || opts.readAt === undefined)
        return new Date(earlier);
    const limit = msOf(opts.readAt) + (opts.skewMs ?? BERLIN_STAMP_SKEW_MS);
    return new Date(later <= limit ? later : earlier);
}
export function berlinMidnight(day: string): Date | null {
    const valid = parseBerlinDay(day);
    return valid === null ? null : berlinToInstant(valid, 0, 0);
}
export function berlinWallToInstantSql(wall: string): string {
    const later = `((${wall}) at time zone 'Europe/Berlin')`;
    return `(case when ((${later} - interval '1 hour') at time zone 'Europe/Berlin') = (${wall})
             then ${later} - interval '1 hour' else ${later} end)`;
}
export function gtfsStopTimeInstantSql(date: string, offset: string): string {
    return berlinWallToInstantSql(`((${date})::date::timestamp + date_part('epoch', ${offset}) * interval '1 second')`);
}
export function gtfsStopTimeOffsetSql(date: string, at: string): string {
    return `(((${at}) at time zone 'Europe/Berlin') - (${date})::date::timestamp)`;
}
export function gtfsStopTimeInstant(serviceDate: BerlinDay | string, seconds: number): Date {
    const days = Math.floor(seconds / 86_400);
    const rest = seconds - days * 86_400;
    return berlinToInstant(addBerlinDays(serviceDate, days), Math.floor(rest / 3600), Math.floor((rest % 3600) / 60), rest % 60, { fold: "earlier", gap: "shift" });
}
export function addBerlinDays(day: BerlinDay | string, n: number): BerlinDay {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10) as BerlinDay;
}
export const addCalendarDays = addBerlinDays;
export function berlinDayDelta(at: Date, now: Date): number {
    const ord = (d: Date): number => Date.parse(`${berlinDay(d)}T00:00:00Z`) / DAY_MS;
    return Math.round(ord(at) - ord(now));
}
export function relativeDayLabel(at: Date, now: Date, language: "de" | "en"): string {
    const delta = berlinDayDelta(at, now);
    const de = language === "de";
    if (delta === 0)
        return de ? "heute" : "today";
    if (delta === -1)
        return de ? "gestern" : "yesterday";
    if (delta === 1)
        return de ? "morgen" : "tomorrow";
    const n = Math.abs(delta);
    const past = delta < 0;
    const unit = (count: number, deOne: string, deMany: string, enOne: string, enMany: string): string => de
        ? past ? `vor ${count} ${count === 1 ? deOne : deMany}` : `in ${count} ${count === 1 ? deOne : deMany}`
        : past ? `${count} ${count === 1 ? enOne : enMany} ago` : `in ${count} ${count === 1 ? enOne : enMany}`;
    if (n < 60)
        return unit(n, "Tag", "Tagen", "day", "days");
    const months = Math.floor(n / 30.44);
    if (months < 24)
        return unit(months, "Monat", "Monaten", "month", "months");
    return unit(Math.floor(n / 365.25), "Jahr", "Jahren", "year", "years");
}
