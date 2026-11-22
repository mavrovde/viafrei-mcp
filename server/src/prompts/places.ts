// The MCP prompts, moved from the ViaFrei platform; comments removed in the move.
import { z } from "zod";
import { ATTRIBUTION_RULE, COVERAGE_RULE, FUEL_ANSWER_SHAPE, MTSK_RULE, NO_INVENTION_RULE, NO_ROUTING_RULE, TIME_RULE, answerIn, definePrompt, joinLines, languageArg, languageOf, rulesBlock, } from "./types.js";
export const findAPlace = definePrompt({
    name: "find_a_place",
    title: "Find out what a name refers to — Herausfinden, was ein Name meint",
    description: "Resolves a bare name of unknown kind into a place, a named thing, or an address, trying each table in turn and stopping at the first that answers. Use when the traveller names something and you do not yet know whether it is a town, a company, or a street address — or to recover after a tool reported a name as ambiguous. Do NOT use once the kind is already known: a settlement name goes straight to find_place, a company or landmark to find_poi, a street address to find_address. Show every attribution line.",
    shape: {
        query: z.string().describe("The name to resolve, exactly as the traveller wrote it. Example: \"Neustadt\", \"adesso\", \"Bahnhofstraße 12, 36037 Fulda\"."),
        near: z
            .string()
            .optional()
            .describe("A second place to measure from, used only if find_place answers with more than one candidate for a common name. Example: \"Hamburg\"."),
        ...languageArg,
    },
    render: (a) => {
        const language = languageOf(a);
        const near = a.near !== undefined && a.near.trim() !== "" ? ` and near="${a.near}"` : "";
        const inTown = a.near !== undefined && a.near.trim() !== "" ? ` and in="${a.near}"` : "";
        return joinLines([
            `Find out what "${a.query}" refers to.`,
            "",
            "Try these tools IN THIS ORDER, and stop at the first one that answers something:",
            `1. find_place with query="${a.query}"${near}. If it lists more than one candidate, show the list — kind, official key, population, English name where one exists — and ask which one is meant rather than guessing.`,
            `2. Only if find_place found nothing: find_poi with name="${a.query}"${inTown} — a company, shop, clinic, hotel or landmark, not a settlement.`,
            `3. Only if find_poi also found nothing: find_address with query="${a.query}" — this needs a house number AND a town or postcode; if the traveller gave neither, say that a street address needs both instead of calling this.`,
            "",
            "Then answer in at most six lines: what kind of thing it is, its coordinate, and its official key or its town/postcode where one applies. If all three tools answered nothing, say so plainly and suggest checking the spelling or adding a postcode — never invent a match to end the search.",
            "",
            ...rulesBlock([ATTRIBUTION_RULE, TIME_RULE, NO_INVENTION_RULE, NO_ROUTING_RULE, COVERAGE_RULE]),
            "",
            answerIn(language),
        ]);
    },
});
export const planLocalErrand = definePrompt({
    name: "plan_local_errand",
    title: "What is around this place? — Was ist hier in der Nähe?",
    description: "Answers \"what is around here\" for one place: the nearest fuel, EV charging, parking, railway station and motorway junction in one glance, then — only if the traveller wants more than the nearest one — the depth tool for that one category. Use when it is a quick local stop with nothing decided yet. Do NOT use once the traveller already knows what they need: a fuel grade's price is plan_fuel_stop or find_cheapest_fuel directly, a specific connector or live status is find_charging_station, parking kind or occupancy is find_parking. Show every attribution line.",
    shape: {
        place: z.string().describe("Where the errand happens — a town, junction, station or street address with its postcode. Example: \"Fulda\"."),
        need: z
            .enum(["fuel", "charging", "parking", "everything"])
            .optional()
            .describe("Narrow the glance to one category when the traveller named one. Defaults to \"everything\", the full glance across all five categories find_nearby covers."),
        ...languageArg,
    },
    render: (a) => {
        const language = languageOf(a);
        const need = a.need ?? "everything";
        return joinLines([
            `What is around ${a.place}${need === "everything" ? "" : ` for ${need}`}?`,
            "",
            "One call answers the glance:",
            `1. find_nearby at ${a.place}, radius_km=5${need === "everything" ? "" : `, narrowed to the ${need} category only`}.`,
            "",
            "The glance is usually the whole answer. Only if the traveller THEN asks for more than the nearest one, call the ONE matching tool for that need — never more than one, and never unprompted:",
            `- a specific fuel grade's price: find_cheapest_fuel at ${a.place} with the grade they named. Answer that part in the shape find_cheapest_fuel always takes: ${FUEL_ANSWER_SHAPE}. One stop for this traveller, this journey.`,
            `- a connector, its power, or live status: find_charging_station at ${a.place}.`,
            `- parking kind or occupancy: find_parking at ${a.place}.`,
            "",
            "Then answer in at most eight lines: one line per category the glance covered, the nearest hit first with its name and distance, and \"nothing nearby\" stated plainly for a category that had none — never invented. A depth call, if made, is added as a short paragraph of its own rather than folded into the glance.",
            "",
            ...rulesBlock([MTSK_RULE, ATTRIBUTION_RULE, TIME_RULE, NO_INVENTION_RULE, NO_ROUTING_RULE, COVERAGE_RULE]),
            "",
            answerIn(language),
        ]);
    },
});
export const explainThisCoordinate = definePrompt({
    name: "explain_this_coordinate",
    title: "Say where a coordinate is — Sagen, wo eine Koordinate liegt",
    description: "Turns a bare lat/lon into a sentence a traveller understands: the nearest address, settlement and motorway junction with their distances, and the Gemeinde, Kreis and Land the point lies in. Use whenever you already hold a coordinate — from the traveller, or from another tool's result — and need to say where it is. Do NOT use to look a place up BY NAME: that is find_a_place, find_place, find_poi or find_address. The Gemeinde, Kreis and Land are read off the municipality's official key (#683), not the nearest gazetteer point. OpenStreetMap ODbL 1.0 for the address; show the attribution line.",
    shape: {
        lat: z.string().describe("Latitude of the point, as a decimal degree. Example: \"50.5546\"."),
        lon: z.string().describe("Longitude of the point, as a decimal degree. Example: \"9.6773\"."),
        ...languageArg,
    },
    render: (a) => {
        const language = languageOf(a);
        return joinLines([
            `Say where ${a.lat}, ${a.lon} is.`,
            "",
            "One call:",
            `1. describe_location with lat=${a.lat} and lon=${a.lon}.`,
            "",
            "Then answer in at most six lines: the nearest address first if one was found, then the nearest settlement with its distance, then the Gemeinde, Kreis and Land the point lies in exactly as the tool states them (it reads them off the municipality's official key, so they carry no distance; where the tool says \"nearest\" instead, near the national border or at sea, say \"nearest\" too), then the nearest motorway junction. Say plainly when the tool found nothing for a fact rather than guessing one — a point far from any address, in a forest or at sea, legitimately has none.",
            "",
            ...rulesBlock([ATTRIBUTION_RULE, TIME_RULE, NO_INVENTION_RULE, NO_ROUTING_RULE]),
            "",
            answerIn(language),
        ]);
    },
});
export const PLACES_PROMPTS = [findAPlace, planLocalErrand, explainThisCoordinate] as const;
