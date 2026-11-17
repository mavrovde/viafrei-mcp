// Vendored from the ViaFrei platform (DB Timetables board, its parser and helpers); comments removed in the move.
const GENERIC_DESTINATION_WORDS = new Set(["bahnhof", "hauptbahnhof", "hbf", "bf", "platz", "strasse", "str", "west", "ost", "nord", "sued", "mitte", "zentrum", "gvh", "vrs", "vrr", "via", "ueber", "richtung", "und", "der", "die", "das", "am", "an", "im", "in"]);
export const DESTINATION_ABBREVIATIONS: Readonly<Record<string, string>> = Object.freeze({
    btf: "betriebshof",
    bhf: "bahnhof",
    bf: "bahnhof",
    hbf: "hauptbahnhof",
    str: "strasse",
    pl: "platz",
    ri: "richtung",
});
function destinationTokens(d: string): string[] {
    const folded = d
        .toLocaleLowerCase("de")
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss");
    return folded.split(/[^a-z0-9]+/).map((w) => DESTINATION_ABBREVIATIONS[w] ?? w).filter((w) => w !== "");
}
function destinationWords(d: string): Set<string> {
    return new Set(destinationTokens(d).filter((w) => w.length >= 3 && !GENERIC_DESTINATION_WORDS.has(w)));
}
export function destinationKnown(a: string | null, b: string | null): boolean {
    return a !== null && b !== null && destinationWords(a).size > 0 && destinationWords(b).size > 0;
}
export function sameDestination(a: string | null, b: string | null): boolean {
    if (a === null || b === null)
        return true;
    const x = destinationWords(a);
    const y = destinationWords(b);
    if (x.size === 0 || y.size === 0)
        return true;
    for (const w of x)
        if (y.has(w))
            return true;
    return false;
}
function wordsOf(d: string | null): string[] {
    return d === null ? [] : [...destinationWords(d)];
}
const keyOf = (ws: readonly string[]): string => [...ws].sort().join(" ");
const sameWord = (a: string, b: string): boolean => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));
const holds = (ws: readonly string[], w: string): boolean => ws.some((x) => sameWord(x, w));
function wordsInAll(sets: readonly (readonly string[])[]): string[] {
    const distinct = new Map<string, readonly string[]>();
    for (const s of sets)
        if (s.length > 0)
            distinct.set(keyOf(s), s);
    const all = [...distinct.values()];
    const [first, ...rest] = all;
    if (first === undefined || rest.length === 0)
        return [];
    return first.filter((w) => rest.every((s) => holds(s, w)));
}
type Agreement = {
    readonly kind: "exact" | "shared" | "unnamed";
    readonly rank: readonly [
        number,
        number,
        number
    ];
} | {
    readonly kind: "contradicts";
    readonly rank: readonly [
        number,
        number,
        number
    ];
};
function agreement(a: readonly string[], b: readonly string[], town: readonly string[]): Agreement {
    if (a.length === 0 || b.length === 0)
        return { kind: "unnamed", rank: [0, 0, 0] };
    const leftA = a.filter((w) => !holds(b, w)).length;
    const leftB = b.filter((w) => !holds(a, w)).length;
    if (leftA === 0 && leftB === 0)
        return { kind: "exact", rank: [1, 0, 0] };
    const [a0] = a;
    const [b0] = b;
    const townFirst = a0 !== undefined && b0 !== undefined && sameWord(a0, b0) && leftA > 0 && leftB > 0 ? a0 : null;
    const shared = a.filter((w) => holds(b, w) && !holds(town, w) && (townFirst === null || !sameWord(w, townFirst))).length;
    if (shared > 0)
        return { kind: "shared", rank: [0, shared, -(leftA + leftB)] };
    if ((leftA === 0 || leftB === 0) && b.filter((w) => !holds(a, w)).every((w) => holds(town, w)))
        return { kind: "shared", rank: [0, 0, -(leftA + leftB)] };
    return { kind: "contradicts", rank: [0, 0, -(leftA + leftB)] };
}
function differentPlaces(candidates: readonly DestinationCandidate[]): string[][] {
    const taken: string[] = [];
    for (const c of candidates) {
        const d = c.destination;
        if (d === null || wordsOf(d).length === 0)
            continue;
        if (taken.every((x) => differentPlacesInOneTown(x, d)))
            taken.push(d);
    }
    return taken.map(wordsOf);
}
function isLineEnd(w: readonly string[], t: readonly string[], lineDestinations: readonly (string | null)[], town: readonly string[]): boolean {
    return lineDestinations.some((d) => {
        const e = wordsOf(d);
        if (e.length === 0 || keyOf(e) === keyOf(t))
            return false;
        const ag = agreement(e, w, town);
        return ag.kind === "exact" || ag.kind === "shared";
    });
}
const cmp = (x: readonly number[], y: readonly number[]): number => {
    for (let i = 0; i < x.length; i += 1)
        if ((x[i] ?? 0) !== (y[i] ?? 0))
            return (x[i] ?? 0) - (y[i] ?? 0);
    return 0;
};
export type DestinationCandidate = {
    readonly destination: string | null;
    readonly mustName?: boolean;
};
export type DestinationChoice = {
    readonly index: number | null;
    readonly ambiguous: readonly number[];
};
export function chooseByDestination(target: string | null, candidates: readonly DestinationCandidate[], rivals: readonly (string | null)[], opts: {
    readonly loneMayContradict: boolean;
    readonly lineDestinations?: readonly (string | null)[];
}): DestinationChoice {
    const t = wordsOf(target);
    const cs = candidates.map((c) => wordsOf(c.destination));
    const rs = rivals.map(wordsOf);
    const town = [...wordsInAll([t, ...rs]), ...wordsInAll(differentPlaces(candidates))];
    const lone = candidates.length === 1 &&
        rivals.length === 0 &&
        opts.loneMayContradict &&
        !isLineEnd(cs[0] ?? [], t, opts.lineDestinations ?? [], town);
    const key = keyOf;
    const otherEnds = (opts.lineDestinations ?? []).map(wordsOf).filter((e) => e.length > 0 && keyOf(e) !== keyOf(t));
    const eligible: {
        index: number;
        rank: readonly number[];
        key: string;
    }[] = [];
    const ambiguous: number[] = [];
    candidates.forEach((c, j) => {
        const w = cs[j] ?? [];
        const ag = agreement(t, w, town);
        if (ag.kind !== "exact" && otherEnds.some((e) => agreement(e, w, town).kind === "exact"))
            return;
        const ok = ag.kind === "exact" || ag.kind === "shared" || (ag.kind === "unnamed" && c.mustName !== true) || (ag.kind === "contradicts" && lone && c.mustName !== true);
        if (!ok)
            return;
        let tied = false;
        for (const r of rs) {
            const rag = agreement(r, w, town);
            if (rag.kind === "contradicts" || (rag.kind === "unnamed" && c.mustName === true))
                continue;
            const d = cmp(rag.rank, ag.rank);
            if (d > 0)
                return;
            if (d === 0 && key(r) !== key(t))
                tied = true;
        }
        if (tied)
            ambiguous.push(j);
        else
            eligible.push({ index: j, rank: ag.rank, key: key(w) });
    });
    if (eligible.length === 0)
        return { index: null, ambiguous };
    const best = eligible.reduce((m, e) => (cmp(e.rank, m.rank) > 0 ? e : m));
    const top = eligible.filter((e) => cmp(e.rank, best.rank) === 0);
    if (top.some((e) => e.key !== best.key))
        return { index: null, ambiguous: [...ambiguous, ...top.map((e) => e.index)].sort((a, b) => a - b) };
    return { index: best.index, ambiguous };
}
const STATION_KIND_WORDS = new Set(["bus", "busbf", "busbahnhof", "zob", "omnibusbahnhof", "bushaltestelle"]);
const STATION_WORDS = new Set(["hauptbahnhof", "bahnhof", ...STATION_KIND_WORDS]);
const withoutQualifier = (d: string): string => d.replace(/\([^)]*\)/g, " ");
const placeWordsOf = (d: string): string[] => wordsOf(withoutQualifier(d)).filter((w) => !STATION_KIND_WORDS.has(w));
export function differentPlacesInOneTown(a: string, b: string): boolean {
    const x = placeWordsOf(a);
    const y = placeWordsOf(b);
    return x.some((w) => !holds(y, w)) && y.some((w) => !holds(x, w));
}
function namesOnlyTheStationAgainst(a: string, b: string): boolean {
    const x = placeWordsOf(a);
    const y = placeWordsOf(b);
    const [town] = x;
    if (x.length !== 1 || town === undefined || y.length < 2 || !sameWord(y[0] ?? "", town))
        return false;
    return destinationTokens(withoutQualifier(a)).some((w) => STATION_WORDS.has(w));
}
export function differentDestinations(a: string, b: string): boolean {
    return differentPlacesInOneTown(a, b) || namesOnlyTheStationAgainst(a, b) || namesOnlyTheStationAgainst(b, a);
}
