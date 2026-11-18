/**
 * The prompts: what each recipe tells the assistant, for its required arguments (pinned in full as text files
 * under test/__snapshots__/prompts) and what every optional argument changes in it (the lines it adds or takes
 * away), asked through prompts/get like a client asks; the argument normalisation a client's loose words
 * go through first; and the price-aggregate rule no recipe may break.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { pinned } from "./pinned.js";
import { connect } from "./harness.js";
import { loadCatalogue } from "../src/catalogue.js";
import { PROMPTS, readPromptArgumentsFirst } from "../src/prompts/index.js";
import { normalisePromptArguments } from "../src/prompts/arguments.js";
import { MTSK_RULE, answerIn, languageOf, priceAggregateAsk, rulesBlock } from "../src/prompts/types.js";

const SAMPLE: Record<string, string> = {
  origin: "München",
  destination: "Berlin",
  roads: "A9, A4",
  departure: "tomorrow 06:30",
  when: "this evening",
  destination_city: "Stuttgart",
  place: "Ingolstadt",
  radius_km: "10",
  from_station: "Köln Hbf",
  to_station: "Düsseldorf",
  arrival: "in 40 minutes",
  query: "Neustadt",
  near: "Hamburg",
  lat: "50.5546",
  lon: "9.6773",
};

let client: Client;
let close: () => Promise<void>;
beforeAll(async () => ({ client, close } = await connect()));
afterAll(async () => close());

const textOf = async (name: string, args: Record<string, string>): Promise<{ text: string; description: string | undefined }> => {
  const r = await client.getPrompt({ name, arguments: args });
  expect(r.messages).toHaveLength(1);
  expect(r.messages[0]!.role).toBe("user");
  return { text: (r.messages[0]!.content as { text: string }).text, description: r.description };
};

/** The lines a variant adds (+) and takes away (-) against the base text. */
const change = (base: string, variant: string): string[] => {
  const b = base.split("\n");
  const v = variant.split("\n");
  return [...v.filter((l) => !b.includes(l)).map((l) => `+ ${l}`), ...b.filter((l) => !v.includes(l)).map((l) => `- ${l}`)];
};

/** The values a client may pass for each enum argument: the contract, spelled here so a test cannot borrow it from the code. */
const CHOICES: Record<string, readonly string[]> = {
  language: ["de", "en"],
  need: ["fuel", "charging", "parking", "everything"],
  vehicle: ["car", "electric", "lorry", "motorhome"],
  topic: ["lez", "speed", "winter", "alcohol", "toll", "truck_ban", "equipment", "emergency", "ev"],
  energy: ["e5", "e10", "diesel", "electric"],
  break_too: ["yes", "no"],
  kind: ["any", "car_park", "park_and_ride", "rest_area", "truck"],
};

const optionalChoices = (schema: unknown): readonly string[] | null => {
  const inner = schema instanceof z.ZodOptional ? (schema.unwrap() as unknown) : null;
  if (inner === null) return null;
  return inner instanceof z.ZodEnum ? (inner.options as string[]) : [];
};

const catalogue = loadCatalogue();

describe("every prompt, through prompts/get", () => {
  for (const p of PROMPTS) {
    const required = Object.fromEntries(Object.entries(p.shape).filter(([, s]) => optionalChoices(s) === null).map(([k]) => [k, SAMPLE[k]!]));

    it(`${p.name}: the recipe for its required arguments, its catalogue description, no price aggregate`, async () => {
      const { text, description } = await textOf(p.name, required);
      expect(description).toBe(catalogue.prompts.find((c) => c.name === p.name)!.description);
      await pinned("prompts", text);
      for (const v of Object.values(required)) expect(text).toContain(v);
      expect(text.split("\n").at(-1)).toBe(answerIn("de"));
      expect(text).toContain(rulesBlock([])[0]);
      expect(priceAggregateAsk(text)).toBeNull();
    });

    for (const [key, schema] of Object.entries(p.shape)) {
      const choices = optionalChoices(schema);
      if (choices === null) continue;
      if (choices.length > 0) expect([key, ...choices]).toEqual([key, ...CHOICES[key]!]);
      const values = choices.length > 0 ? CHOICES[key]! : [SAMPLE[key]!];
      it(`${p.name}: what ${key} changes (${values.join(", ")})`, async () => {
        const base = (await textOf(p.name, required)).text;
        const out: Record<string, string[]> = {};
        for (const value of values) {
          const { text } = await textOf(p.name, { ...required, [key]: value });
          expect(priceAggregateAsk(text)).toBeNull();
          out[value] = change(base, text);
          // A blank optional argument is the argument left out: the client's empty field changes nothing.
          if (choices.length === 0) expect(p.run({ ...required, [key]: "  " })).toBe(base);
        }
        await pinned("prompts", out);
      });
    }
  }

  it("prepare_car_trip: an electric car adds the ev topic call unless ev was the topic asked", async () => {
    const base = (await textOf("prepare_car_trip", { destination_city: "Stuttgart" })).text;
    const ev = change(base, (await textOf("prepare_car_trip", { destination_city: "Stuttgart", vehicle: "electric", topic: "ev" })).text);
    const lez = change(base, (await textOf("prepare_car_trip", { destination_city: "Stuttgart", vehicle: "electric", topic: "lez" })).text);
    await pinned("prompts", { ev, lez });
    expect(lez.some((l) => l.startsWith("+ 3. Read viafrei://rules/electric-driving"))).toBe(true);
    expect(ev.some((l) => l.startsWith("+ 2. Read viafrei://rules/electric-driving"))).toBe(true);
  });

  it("plan_fuel_stop: a named grade is passed and not called assumed; electric with a break", async () => {
    const base = (await textOf("plan_fuel_stop", { place: "Ingolstadt" })).text;
    expect(base).toContain('fuel="e10"');
    expect(base).toContain(MTSK_RULE);
    const diesel = (await textOf("plan_fuel_stop", { place: "Ingolstadt", energy: "diesel", break_too: "yes" })).text;
    expect(diesel).toContain('fuel="diesel"');
    await pinned("prompts", change(base, diesel));
    const electric = (await textOf("plan_fuel_stop", { place: "Ingolstadt", energy: "electric", radius_km: "20" })).text;
    expect(electric).toContain("radius_km=20");
    expect(electric).not.toContain(MTSK_RULE);
  });
});

describe("loose argument words are normalised before a prompt renders", () => {
  for (const [said, language] of [["English", "en"], ["en-GB", "en"], [" Deutsch ", "de"], ["GER", "de"], ["englisch", "en"], ["deu", "de"], ["de", "de"], ["en", "en"], ["ENG", "en"], ["german", "de"], ["de-AT", "de"]] as const) {
    it(`language "${said}" answers in ${language}`, async () => {
      const { text } = await textOf("plan_commute", { from_station: "Köln Hbf", language: said });
      expect(text.split("\n").at(-1)).toBe(answerIn(language));
    });
  }

  it("an enum value in another case or with spaces is the catalogue's value", async () => {
    const { text } = await textOf("plan_arrival_parking", { destination: "Köln", kind: " Park And-Ride " });
    expect(text).toContain('with kind="park_and_ride"');
  });

  it("normalisePromptArguments, rule by rule", () => {
    const shape = PROMPTS.find((p) => p.name === "plan_arrival_parking")!.shape;
    expect(normalisePromptArguments(shape, undefined)).toBeUndefined();
    expect(normalisePromptArguments(shape, { destination: " Köln ", arrival: "  ", kind: "TRUCK", language: "fr", extra: 3 })).toStrictEqual({ destination: " Köln ", kind: "truck", extra: 3 });
    expect(normalisePromptArguments(shape, { kind: "park  and--ride" })).toStrictEqual({ kind: "park_and_ride" });
    expect(normalisePromptArguments(shape, { kind: "boat", language: "en_us" })).toEqual({ kind: "boat", language: "en" });
    expect(normalisePromptArguments(shape, { language: "english language" })).toEqual({ language: "en" });
    expect(normalisePromptArguments({ language: z.string() }, { language: "English" })).toEqual({ language: "English" });
    expect(normalisePromptArguments({ language: z.enum(["de"]) }, { language: "English" })).toEqual({});
  });

  it("an unknown prompt is refused by the SDK, its arguments untouched", async () => {
    await expect(client.getPrompt({ name: "no_such_prompt", arguments: { language: "English" } })).rejects.toThrow(/no_such_prompt/);
  });

  it("readPromptArgumentsFirst needs the SDK's prompts/get handler", () => {
    const bare = new McpServer({ name: "t", version: "0" });
    expect(() => readPromptArgumentsFirst(bare)).toThrow("the SDK's prompts/get handler was not found; readPromptArgumentsFirst needs updating for this SDK");
  });
});

describe("the recipe helpers", () => {
  it("languageOf falls back to German; answerIn says which language to pass", () => {
    expect(languageOf({})).toBe("de");
    expect(languageOf({ language: "en" })).toBe("en");
    expect(answerIn("de")).toMatch(/^Answer the traveller in German, and pass language: "de"/);
    expect(answerIn("en")).toMatch(/^Answer the traveller in English, and pass language: "en".*keep the German term in parentheses/);
  });

  it("rulesBlock heads the rules and bullets each", () => {
    expect(rulesBlock(["a", "b"])).toEqual(["Rules that are not negotiable:", "- a", "- b"]);
  });

  const asks: [string, string][] = [
    ["what is the average price", "average"],
    ["the mean of it", "mean"],
    ["median diesel", "median"],
    ["aggregated prices", "aggregated"],
    ["a ranking please", "ranking"],
    ["fuel statistics", "statistics"],
    ["der Durchschnittspreis", "Durchschnittspreis"],
    ["der Mittelwert", "Mittelwert"],
    ["eine Statistik", "Statistik"],
    ["eine Rangliste", "Rangliste"],
    ["als Liste", "Liste"],
    ["eine Tabelle", "Tabelle"],
    ["eine Preisübersicht", "Preisübersicht"],
    ["ein Vergleich", "Vergleich"],
    ["der Preisspiegel", "Preisspiegel"],
    ["eine Preis-Liste", "Preis-Liste"],
    ["eine Preistabelle", "Preistabelle"],
    ["price-chart", "price-chart"],
    ["price board", "price board"],
    ["diesel-ranking", "diesel-ranking"],
    ["petrols summary", "petrols summary"],
    ["the top 5 stations", "top 5"],
    ["per brand", "per brand"],
    ["je Marke", "je Marke"],
    ["cheapest three stations", "cheapest three"],
    ["the cheapest e10 10", "cheapest e10 10"],
    ["die billigsten drei", "billigsten drei"],
    ["the cheapest stations", "cheapest stations"],
    ["a weekly overview", "weekly overview"],
    ["nationwide-report", "nationwide-report"],
    ["as a spreadsheet", "spreadsheet"],
    ["send a csv", "csv"],
    ["the dataset", "dataset"],
    ["der Datensatz", "Datensatz"],
  ];
  for (const [text, found] of asks) {
    it(`priceAggregateAsk finds "${found}" in "${text}"`, () => {
      expect(priceAggregateAsk(text)).toBe(found);
    });
  }

  for (const text of ["the cheapest e10 near Ulm", "is it open", "Kassel near Fulda", "Gleisliste? no: the platform", "the cheapest", "demeaning", "listed", "Vergleichbarkeit is not here, but"]) {
    it(`priceAggregateAsk finds nothing it should not in "${text}"`, () => {
      const hit = priceAggregateAsk(text);
      if (text.startsWith("Vergleich")) expect(hit).toBe("Vergleichbarkeit");
      else expect(hit).toBeNull();
    });
  }

  it("the fuel rule itself is no aggregate ask", () => {
    expect(priceAggregateAsk(`${MTSK_RULE} Answer the stop.`)).toBeNull();
    expect(priceAggregateAsk(`${MTSK_RULE} and a ranking`)).toBe("ranking");
    expect(priceAggregateAsk(`als Liste${MTSK_RULE}bitte`)).toBe("Liste");
  });
});
