/**
 * One MCP server per session: the catalogue's tools and resources, answered from the ViaFrei API; the
 * prompts as the moved prompt module registers them. State lives in memory: the session's watches and
 * its truck-parking consent. Nothing here reads a database.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  type CallToolResult,
  type ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { ApiClient } from "./api/client.js";
import { ApiError } from "./api/client.js";
import type * as T from "./api/types.js";
import type { Catalogue } from "./catalogue.js";
import { log } from "./log.js";
import { apiFailure, languageOf, toolError, withPlaceCredits } from "./presentation.js";
import { readPromptArgumentsFirst, registerPrompts } from "./prompts/index.js";
import { ElicitResultSchema, SID_CONSENT_TIMEOUT_MS, SidConsent } from "./sid-consent.js";
import { SessionWatches, type ToolContext } from "./tools/context.js";
import { HANDLERS } from "./tools/handlers.js";
import { inputCheck } from "./validate.js";
import { REFRESH_WAIT, type RefreshWait } from "./tools/trains.js";

export type ServerDeps = { readonly api: ApiClient; readonly catalogue: Catalogue; readonly refreshWait?: RefreshWait };

const RULES_TOPICS: Readonly<Record<string, readonly string[]>> = {
  "viafrei://rules/driving-in-germany": ["speed", "alcohol", "winter", "equipment", "toll", "truck_ban"],
  "viafrei://rules/low-emission-zones": ["lez"],
  "viafrei://emergency": ["emergency"],
  "viafrei://rules/electric-driving": ["ev"],
};

export function createServer(deps: ServerDeps): McpServer {
  const { catalogue } = deps;
  const server = new McpServer(
    { ...catalogue.serverInfo },
    { capabilities: catalogue.capabilities as never, instructions: catalogue.instructions },
  );
  registerPrompts(server);
  readPromptArgumentsFirst(server);

  const watches = new SessionWatches();
  const consent = new SidConsent(() => server.server.getClientCapabilities());
  const toolNames = new Set(catalogue.tools.map((t) => t.name));
  const checkInput = inputCheck(catalogue.tools);

  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: catalogue.tools }));
  server.server.setRequestHandler(CallToolRequestSchema, async (request, extra): Promise<CallToolResult> => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    const language = languageOf(args["language"]);
    const handler = HANDLERS[name];
    if (!toolNames.has(name) || handler === undefined) return toolError(language === "de" ? `Unbekanntes Werkzeug: ${name}` : `Unknown tool: ${name}`);
    const refused = checkInput(name, args);
    if (refused !== null) return refused;
    const ctx: ToolContext = {
      tool: name,
      api: deps.api.withLanguage(language),
      refreshWait: deps.refreshWait ?? REFRESH_WAIT,
      language,
      watches,
      askSidConsent: (lang) =>
        consent.ask(lang, (params) => extra.sendRequest({ method: "elicitation/create", params }, ElicitResultSchema, { timeout: SID_CONSENT_TIMEOUT_MS })),
    };
    const started = Date.now();
    try {
      const result = await withPlaceCredits(() => handler(args, ctx));
      log.info({ tool: name, ms: Date.now() - started, isError: result.isError === true }, "tool call");
      return result;
    } catch (err) {
      log.warn({ tool: name, ms: Date.now() - started, error: err instanceof Error ? err.name : "error", kind: err instanceof ApiError ? err.kind : null }, "tool call failed");
      if (err instanceof ApiError) return apiFailure(err, language);
      return toolError(language === "de" ? "Bei dieser Anfrage ist ein Fehler aufgetreten." : "Something went wrong with this request.");
    }
  });

  server.server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: catalogue.resources }));
  server.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: catalogue.resourceTemplates }));
  server.server.setRequestHandler(SubscribeRequestSchema, async () => ({}));
  server.server.setRequestHandler(UnsubscribeRequestSchema, async () => ({}));
  server.server.setRequestHandler(ReadResourceRequestSchema, async (request): Promise<ReadResourceResult> => readResource(request.params.uri, deps.api, watches));
  return server;
}

const json = (uri: string, value: unknown): ReadResourceResult => ({ contents: [{ uri, mimeType: "application/json", text: JSON.stringify(value, null, 2) }] });

export async function readResource(uri: string, api: ApiClient, watches: SessionWatches): Promise<ReadResourceResult> {
  if (uri === "viafrei://attribution") {
    const r = await api.get<T.SourceRow[]>("listSources", {});
    return { contents: [{ uri, mimeType: "text/plain", text: r.data.map((s) => `${s.family}: ${s.attribution} (${s.licence}, ${s.licenceUrl})`).join("\n") }] };
  }
  if (uri === "viafrei://coverage") {
    const [sources, places] = await Promise.all([api.get<T.SourceRow[]>("listSources", {}), api.get<T.PlacesCoverageData>("getPlacesCoverage", {})]);
    return json(uri, { sources: sources.data, places: places.data });
  }
  if (uri === "viafrei://status/feeds") return json(uri, (await api.get<T.SourceRow[]>("listSources", {})).data);
  if (uri === "viafrei://gazetteer") {
    const d = (await api.get<T.PlacesCoverageData>("getPlacesCoverage", {})).data;
    return json(uri, { kinds: d.kinds, lands: d.lands });
  }
  if (uri === "viafrei://addresses") return json(uri, (await api.get<T.PlacesCoverageData>("getPlacesCoverage", {})).data.addresses);
  if (uri === "viafrei://watches") return json(uri, watches.list());
  const topics = RULES_TOPICS[uri];
  if (topics !== undefined) {
    const reads = await Promise.all(topics.map((topic) => api.get<T.DrivingRulesData>("getDrivingRules", { topic })));
    const md = reads.map((r) => [`## ${r.data.title}`, ...r.data.rules.map((x) => `- ${x.text}${x.legalBasis === null ? "" : ` (${x.legalBasis})`}`), "", `_${r.data.disclaimer} (${r.data.reviewedOn})_`].join("\n")).join("\n\n");
    return { contents: [{ uri, mimeType: "text/markdown", text: md }] };
  }
  const watch = /^viafrei:\/\/watch\/(\d+)$/.exec(uri);
  if (watch !== null) {
    const w = watches.get(Number(watch[1]));
    if (w === undefined) throw new Error(`no watch ${watch[1]} in this conversation`);
    return json(uri, (await api.get<T.WatchData>("getWatch", { watch_id: w.watchId })).data);
  }
  const place = /^viafrei:\/\/place\/(.+)$/.exec(uri);
  if (place !== null) return json(uri, (await api.get<T.PlaceItem[]>("listPlaces", { q: decodeURIComponent(place[1]!), limit: 5 })).data);
  throw new Error(`unknown resource ${uri}`);
}
