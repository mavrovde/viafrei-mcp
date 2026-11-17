// Vendored from the ViaFrei platform (DB Timetables board, its parser and helpers); comments removed in the move.
const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string): Intl.DateTimeFormat {
    let f = formatters.get(zone);
    if (f === undefined) {
        f = new Intl.DateTimeFormat("en-GB", {
            timeZone: zone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hourCycle: "h23",
        });
        formatters.set(zone, f);
    }
    return f;
}
export function zoneOffsetMs(zone: string, instantMs: number): number {
    const whole = instantMs - (((instantMs % 1000) + 1000) % 1000);
    const p = Object.fromEntries(formatter(zone).formatToParts(new Date(whole)).map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(Number(p["year"]), Number(p["month"]) - 1, Number(p["day"]), Number(p["hour"]), Number(p["minute"]), Number(p["second"]));
    return asUtc - whole;
}
export function wallClockToInstant(wallMs: number, zone: string): Date {
    const before = zoneOffsetMs(zone, wallMs - DAY_MS);
    const after = zoneOffsetMs(zone, wallMs + DAY_MS);
    const valid = [...new Set([before, after])]
        .map((offset) => wallMs - offset)
        .filter((instant) => instant + zoneOffsetMs(zone, instant) === wallMs)
        .sort((a, b) => a - b);
    return new Date(valid[0] ?? wallMs - before);
}
