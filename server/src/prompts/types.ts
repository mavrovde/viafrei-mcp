// The MCP prompts, moved from the ViaFrei platform; comments removed in the move.
import { z } from "zod";
export type PromptLanguage = "de" | "en";
export type PromptDef<S extends z.ZodRawShape = z.ZodRawShape> = {
    name: string;
    title: string;
    description: string;
    shape: S;
    render: (args: z.infer<z.ZodObject<S>>) => string;
};
export type AnyPromptDef = {
    name: string;
    title: string;
    description: string;
    shape: z.ZodRawShape;
    run: (args: unknown) => string;
};
export function definePrompt<S extends z.ZodRawShape>(d: PromptDef<S>): PromptDef<S> & AnyPromptDef {
    return { ...d, run: (args) => d.render(args as z.infer<z.ZodObject<S>>) };
}
export const languageArg = {
    language: z
        .enum(["de", "en"])
        .optional()
        .describe("Set this to the language the traveller is writing in: \"en\" for English, \"de\" for German. It decides both the language you answer in and the language argument you pass to every tool call in the recipe. Leave it out only when the language is genuinely unclear — the fallback is German, because the road is German."),
};
export function languageOf(args: {
    language?: PromptLanguage | undefined;
}): PromptLanguage {
    return args.language ?? "de";
}
export function answerIn(language: PromptLanguage): string {
    return language === "de"
        ? "Answer the traveller in German, and pass language: \"de\" to every tool call in the recipe. Place names, station names and road numbers are never translated."
        : "Answer the traveller in English, and pass language: \"en\" to every tool call in the recipe. Place names, station names and road numbers are never translated; keep the German term in parentheses so the traveller recognises it on the signs.";
}
export const ATTRIBUTION_RULE = "Show the attribution line of every result you used, verbatim and in full, at the end of your answer. When a result carries a purpose note in its metadata, repeat that sentence verbatim as well. Both are conditions of the licence, not captions you may summarise away.";
export const TIME_RULE = "All times are Europe/Berlin. Render a departure as 08:05 (+3 min) and keep each result's Stand / As of line, so the traveller knows how old the answer is.";
export const NO_ROUTING_RULE = "There is no door-to-door routing in this version. Do not turn these answers into a route, a connection with changes, a distance or a travel time — name the places, roads and stations the traveller gave you, and say plainly that the journey itself is theirs to plan.";
export const NO_INVENTION_RULE = "Report only what the tools returned. An empty answer is an answer: say what was searched and how it could be widened, and never fill a gap with a plausible station, price, platform or free space.";
export const COVERAGE_RULE = "If a tool reports that it holds nothing for this place, read the viafrei://coverage resource and tell the traveller plainly which data we do not have here, instead of trying a different tool until one answers something.";
export const MTSK_RULE = "Fuel prices are consumer information for this one traveller and this one journey. Answer the stop they asked about: never build a price list, a ranking, a regional average, a cheapest-in-Germany table or any other aggregate, and never present the prices as data to pass on or store.";
export const SHARE_ALIKE_RULE = "The punctuality figures from check_transit_disruption are share-alike (CC BY-SA; the licensor states no version) when they come from DELFI. For Berlin and Brandenburg they may come from VBB instead, under CC BY 4.0, which is not share-alike; the result's attribution line says which. Show them with their own attribution line and keep it clear which figures they are, so a reader can tell what the share-alike covers. You may put them beside road, weather, fuel or departure data in one answer or one table: showing two sources next to each other places no obligation on the other source, though each source's own terms still apply to it. What you may not do is merge share-alike figures into a single derived figure, score or index — that is an adaptation, and the result would itself be share-alike.";
export const RULES_ADVICE_RULE = "The driving-rules answers are informational and carry the date a human last reviewed them. Say that date, name the official source each fact links to, and do not present any of it as legal advice.";
export const FUEL_ANSWER_SHAPE = "the cheapest station first with its price, brand, distance and whether it is open, then the alternatives, then how old the prices are";
const PRICE_AGGREGATE = new RegExp([
    "average", String.raw `\bmean\b`, "median", String.raw `aggregat\w*`, "ranking", String.raw `statistic\w*`,
    String.raw `durchschnitt\w*`, "mittelwert", String.raw `statistik\w*`, "rangliste",
    String.raw `\bliste\b`, String.raw `\btabelle\b`, String.raw `\bübersicht\b`, String.raw `vergleich\w*`, "preisspiegel",
    "preis[- ]?(liste|tabelle|übersicht|vergleich)",
    "price[- ](list|table|overview|comparison|chart|board|summary)",
    "(fuel|petrol|diesel|price)s?[- ](list|table|overview|ranking|chart|summary)",
    String.raw `top \d+`, "(per|by|pro|je) (brand|marke)",
    String.raw `cheapest (\w+ )?(two|three|four|five|ten|twenty|\d+)`,
    String.raw `billigste\w* (zwei|drei|fünf|zehn|\d+)`,
    String.raw `cheapest [a-zäöüß]+s\b`,
    "(weekly|monthly|daily|regional|nationwide|country-wide)[- ](overview|summary|table|list|digest|report)",
    "spreadsheet", String.raw `\bcsv\b`, "dataset", "datensatz",
].join("|"), "iu");
export function priceAggregateAsk(text: string): string | null {
    const outsideTheRule = text.split(MTSK_RULE).join(" ");
    return PRICE_AGGREGATE.exec(outsideTheRule)?.[0] ?? null;
}
export function joinLines(lines: readonly string[]): string {
    return lines.join("\n");
}
export function rulesBlock(rules: readonly string[]): readonly string[] {
    return ["Rules that are not negotiable:", ...rules.map((r) => `- ${r}`)];
}
