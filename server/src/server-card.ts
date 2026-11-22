/**
 * The MCP server card: public, read-only metadata at three well-known paths, the same card the server this one
 * replaces serves. The tools are the catalogue's, so the card cannot name a tool the server does not register.
 */
import { SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/sdk/types.js";
import type { Catalogue } from "./catalogue.js";

export const SERVER_CARD_SCHEMA = "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json";
/** The card's own media type, served to a client that names it in `Accept`; plain JSON to everybody else. */
export const SERVER_CARD_MEDIA_TYPE = "application/mcp-server-card+json";
export const PUBLIC_MCP_ENDPOINT = "https://mcp.viafrei.de/mcp";
/** Where clients look for a card: the SEP's path and the two well-known spellings in use. */
export const SERVER_CARD_PATHS = ["/mcp/server-card", "/.well-known/mcp.json", "/.well-known/mcp/server-card.json"] as const;
/** RFC 9116: one security.txt, viafrei.de's, so the two hosts name one contact. */
export const SECURITY_TXT_URL = "https://viafrei.de/.well-known/security.txt";

/** True for a card path, case and trailing slash aside (Express routes match the same way). */
export function isServerCardPath(path: string): boolean {
  return (SERVER_CARD_PATHS as readonly string[]).includes(path.toLowerCase().replace(/\/$/, ""));
}

/** The first protocol revision with Streamable HTTP; the card's remote speaks it and every later one. */
export const STREAMABLE_HTTP_SINCE = "2025-03-26";
export const STREAMABLE_HTTP_PROTOCOL_VERSIONS: readonly string[] = SUPPORTED_PROTOCOL_VERSIONS.filter((v) => v >= STREAMABLE_HTTP_SINCE);

const TAGLINE = "The German Real-Time Mobility Context Platform for AI";
const PITCH_LEAD = "ViaFrei gives AI assistants real-time awareness of Germany";
const PITCH_CLOSE = "One MCP. No API key. No sign-up.";
const PITCH = `${PITCH_LEAD}. Trains and buses, traffic and roadworks, fuel, charging, parking and weather. ${PITCH_CLOSE}`;
/** SEP-2127 caps the card's description at 100 characters. */
export const DESCRIPTION_MAX = 100;

/** The longest brand sentence that fits `max` characters. */
export function brandWithin(max: number): string {
  for (const form of [PITCH, `${PITCH_LEAD}. ${PITCH_CLOSE}`, TAGLINE]) if (form.length <= max) return form;
  throw new Error(`no brand form fits ${String(max)} characters; the tagline is ${String(TAGLINE.length)}`);
}

export type CardTool = { readonly name: string; readonly title: string };

export type ServerCard = {
  readonly $schema: string;
  readonly name: string;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly websiteUrl: string;
  readonly repository: { readonly url: string; readonly source: string };
  readonly remotes: readonly { readonly type: "streamable-http"; readonly url: string; readonly supportedProtocolVersions: readonly string[] }[];
  readonly _meta: Readonly<Record<string, unknown>>;
};

/** Every catalogue tool by name and title (its annotation title, else its name). */
export function cardTools(catalogue: Catalogue): CardTool[] {
  return catalogue.tools.map((t) => ({ name: t.name, title: t.annotations?.title ?? t.title ?? t.name }));
}

export function serverCard(catalogue: Catalogue): ServerCard {
  return {
    $schema: SERVER_CARD_SCHEMA,
    name: "de.viafrei/mcp",
    version: catalogue.serverInfo.version,
    title: "ViaFrei",
    description: brandWithin(DESCRIPTION_MAX),
    websiteUrl: "https://viafrei.de",
    repository: { url: "https://github.com/mavrovde/viafrei-mcp", source: "github" },
    remotes: [{ type: "streamable-http", url: PUBLIC_MCP_ENDPOINT, supportedProtocolVersions: [...STREAMABLE_HTTP_PROTOCOL_VERSIONS] }],
    _meta: {
      "de.viafrei/authentication": "none",
      "de.viafrei/attribution": "viafrei://attribution",
      "de.viafrei/llms": "https://viafrei.de/llms.txt",
      "de.viafrei/sitemap": "https://viafrei.de/sitemap-index.xml",
      "de.viafrei/tools": cardTools(catalogue),
    },
  };
}
