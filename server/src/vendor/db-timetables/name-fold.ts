// Vendored from the ViaFrei platform (DB Timetables board, its parser and helpers); comments removed in the move.
export function normalizeName(raw: string): string {
    return raw
        .toLowerCase()
        .replaceAll(/ß/gu, "ss")
        .normalize("NFD")
        .replaceAll(/\p{Diacritic}/gu, "")
        .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
}
export function transliterateDigraphs(folded: string): string | null {
    let out = folded;
    for (const [digraph, , bare] of DIGRAPHS)
        out = out.replaceAll(digraph, bare);
    return out === folded ? null : out;
}
const DIGRAPHS: readonly (readonly [
    digraph: string,
    umlaut: string,
    bare: string
])[] = [["oe", "ö", "o"], ["ue", "ü", "u"], ["ae", "ä", "a"]];
export function umlautSpelling(text: string): string | null {
    const lower = text.toLowerCase();
    let out = lower;
    for (const [digraph, umlaut] of DIGRAPHS)
        out = out.replaceAll(new RegExp(digraph === "ue" ? "(?<!q)ue" : digraph, "gu"), umlaut);
    return out === lower ? null : out;
}
