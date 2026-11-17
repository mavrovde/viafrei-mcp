/**
 * The truck-parking (SID) consent, asked by MCP elicitation, once per session. The API gates the
 * occupancy behind `accept_terms` and states the terms in `meta.terms`; the server passes the
 * acceptance only after the person accepted here, never on their behalf.
 */
import { ElicitResultSchema, type ClientCapabilities, type ElicitRequestFormParams, type ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import type { Language } from "./presentation.js";

export type ConsentOutcome = "accepted" | "declined" | "unsupported" | "not_answered";

export const SID_CONSENT_TIMEOUT_MS = 120_000;

export const SID_TERMS_URL = { de: "https://viafrei.de/terms#sid", en: "https://viafrei.de/en/terms#sid" } as const;

/** The line beside every SID figure. */
export const SID_CONDITION_NOTE = {
  de: `Lkw-Stellplatzbelegung: Toll Collect GmbH, Stellplatz-Informationsdienst (SID) via Mobilithek. Die Angaben können ungenau, unvollständig oder veraltet sein; keine Gewähr. Es gelten die Nutzungsbedingungen, Abschnitt 2: ${SID_TERMS_URL.de}`,
  en: `Truck-parking occupancy: Toll Collect GmbH, Stellplatz-Informationsdienst (SID) via Mobilithek. The figures may be inaccurate, incomplete or out of date; no warranty. ViaFrei's terms of use, section 2, apply: ${SID_TERMS_URL.en}`,
} as const;

const QUESTION: Readonly<Record<Language, string>> = {
  de: "Die Lkw-Stellplatzbelegung wird nur angezeigt, wenn Sie den Nutzungsbedingungen von ViaFrei, Abschnitt 2, zustimmen. Stimmen Sie zu?",
  en: "Truck-parking occupancy is shown only if you accept ViaFrei's terms of use, section 2. Do you accept these terms?",
};

export function sidElicitation(language: Language): ElicitRequestFormParams {
  return {
    message: `${SID_CONDITION_NOTE[language]}\n\n${QUESTION[language]}`,
    requestedSchema: {
      type: "object",
      properties: {
        accept: {
          type: "boolean",
          title: language === "de" ? "Ich stimme den Nutzungsbedingungen, Abschnitt 2, zu" : "I accept the terms of use, section 2",
          description: language === "de" ? "Ohne Zustimmung nennt ViaFrei die Lkw-Parkplätze ohne Belegung." : "Without acceptance ViaFrei names the truck parks without occupancy.",
        },
      },
      required: ["accept"],
    },
  };
}

export function outcomeOf(r: ElicitResult): "accepted" | "declined" | "not_answered" {
  if (r.action === "accept") {
    const box = r.content?.["accept"];
    if (box === true) return "accepted";
    return box === false ? "declined" : "not_answered";
  }
  if (r.action === "decline") return "declined";
  return "not_answered";
}

export type ElicitSender = (params: ElicitRequestFormParams) => Promise<ElicitResult>;

/** One session's answer, remembered for the session; a missed or timed-out question is asked again next time. */
export class SidConsent {
  private state: "accepted" | "declined" | undefined;
  private inFlight: Promise<ConsentOutcome> | undefined;

  constructor(private readonly capabilities: () => ClientCapabilities | undefined) {}

  supported(): boolean {
    const caps = this.capabilities();
    return caps !== undefined && typeof caps.elicitation === "object" && caps.elicitation !== null;
  }

  known(): ConsentOutcome | undefined {
    if (this.state !== undefined) return this.state;
    return this.supported() ? undefined : "unsupported";
  }

  async ask(language: Language, send: ElicitSender | undefined): Promise<ConsentOutcome> {
    const known = this.known();
    if (known !== undefined) return known;
    if (send === undefined) return "unsupported";
    if (this.inFlight !== undefined) return this.inFlight;
    this.inFlight = (async (): Promise<ConsentOutcome> => {
      try {
        const out = outcomeOf(await send(sidElicitation(language)));
        if (out !== "not_answered") this.state = out;
        return out;
      } catch {
        return "not_answered";
      } finally {
        this.inFlight = undefined;
      }
    })();
    return this.inFlight;
  }
}

export { ElicitResultSchema };
