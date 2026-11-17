// Vendored from the ViaFrei platform (DB Timetables board, its parser and helpers); comments removed in the move.
export function isReplacementStopCode(name: string): boolean {
    return /^\s*Ersatz(?:\s+\d+)+\s*$/u.test(name);
}
export function shownDestination(name: string, language: "de" | "en"): string {
    if (!isReplacementStopCode(name))
        return name;
    return language === "de" ? `Ersatzhaltestelle „${name.trim()}“` : `replacement stop "${name.trim()}"`;
}
export function spacedStationName(name: string): string {
    return name
        .replace(/([^\s(])\(/gu, "$1 (")
        .replace(/\)(?=[\p{L}\p{N}])/gu, ") ")
        .replace(/\s{2,}/gu, " ")
        .trim();
}
export const CUT_NAME_MIN_LENGTH = 24;
export function completedStopName(published: string, fuller: string | null | undefined): string {
    if (fuller === null || fuller === undefined)
        return published;
    const p = published.trim();
    const f = fuller.trim();
    if (p.length < CUT_NAME_MIN_LENGTH || f.length <= 0)
        return published;
    if (!/[\p{L}\p{N}]$/u.test(p))
        return published;
    for (let k = 0; k < p.length; k++) {
        if (k > 0 && !/[\s,/-]/u.test(p[k - 1] ?? ""))
            continue;
        const tail = p.slice(k);
        if (!/\s/u.test(tail.trim()))
            break;
        if (f.length > tail.length && f.startsWith(tail) && /[\p{L}\p{N}]/u.test(f[tail.length] ?? ""))
            return p.slice(0, k) + f;
    }
    return published;
}
