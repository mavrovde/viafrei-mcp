// The MCP prompts, moved from the ViaFrei platform; comments removed in the move.
import { z } from "zod";
function choicesOf(schema: unknown): readonly string[] | null {
    const inner = schema instanceof z.ZodOptional ? (schema.unwrap() as unknown) : schema;
    return inner instanceof z.ZodEnum ? (inner.options as readonly string[]) : null;
}
const fold = (v: string): string => v.trim().toLowerCase().replace(/[\s-]+/gu, "_");
const LANGUAGE_WORDS: ReadonlyMap<string, "de" | "en"> = new Map([
    ["de", "de"], ["deu", "de"], ["ger", "de"], ["german", "de"], ["deutsch", "de"],
    ["en", "en"], ["eng", "en"], ["english", "en"], ["englisch", "en"],
]);
function languageCode(v: string): "de" | "en" | null {
    const f = fold(v);
    return LANGUAGE_WORDS.get(f) ?? LANGUAGE_WORDS.get(f.split("_")[0] ?? "") ?? null;
}
export function normalisePromptArguments(shape: z.ZodRawShape, args: Readonly<Record<string, unknown>> | undefined): Record<string, unknown> | undefined {
    if (args === undefined)
        return undefined;
    const out: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(args)) {
        if (typeof value !== "string") {
            out[name] = value;
            continue;
        }
        if (value.trim() === "")
            continue;
        const choices = choicesOf(shape[name]);
        if (choices === null) {
            out[name] = value;
            continue;
        }
        if (name === "language") {
            const code = languageCode(value);
            if (code !== null && choices.includes(code))
                out[name] = code;
            continue;
        }
        const match = choices.find((c) => fold(c) === fold(value));
        out[name] = match ?? value;
    }
    return out;
}
