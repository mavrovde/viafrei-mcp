/**
 * get_train_departures: the one live provider call that stays in the MCP server. With an EVA number the
 * board comes from DB Timetables (vendored client, 60/min limiter) and is handed to the API's train-board
 * write operation when the contract has one, so the live answers are kept on the API side.
 * A station given by name resolves through the API's station search; the contract's Station carries no
 * EVA numbers yet, so a named station's board is the API's own departure board until it does.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DataMeta } from "../api/client.js";
import type * as T from "../api/types.js";
import { log, redact } from "../log.js";
import { berlinTime, toolError, toolResult, type Language } from "../presentation.js";
import { fetchDepartureBoard, type DepartureBoard } from "../vendor/db-timetables/db-board.js";
import { DbApiError } from "../vendor/db-timetables/client.js";
import { num, str, strs, type Handler, type ToolContext } from "./context.js";

/** The write operation the board is handed to, when the contract has it. */
export const TRAIN_BOARD_WRITE_OPERATION = "postTrainBoard";

const L = (language: Language, de: string, en: string): string => (language === "de" ? de : en);

/** The DB Timetables attribution, as the API's source register states it for this family. */
export const DB_TIMETABLES_META: DataMeta = {
  requestId: "db-timetables-live",
  generatedAt: new Date(0).toISOString(),
  language: "de",
  attribution: [{ family: "db_timetables", text: "Deutsche Bahn AG, DB Timetables API (CC BY 4.0)", licence: "CC BY 4.0" }],
  notes: { condition: [], purpose: [] },
};

function boardText(board: DepartureBoard, language: Language, limit: number): string {
  const rows = board.departures.slice(0, limit).map((d) => {
    const delay = d.cancelled ? L(language, " · fällt aus", " · cancelled") : d.delayMin > 0 ? ` · +${d.delayMin}` : "";
    const platform = d.platform === null ? "" : `${L(language, " · Gl. ", " · pl. ")}${d.platform}${d.platformChanged ? "!" : ""}`;
    return `- ${berlinTime(d.plannedAt.toISOString())} ${d.line} → ${d.destination ?? "?"}${delay}${platform}`;
  });
  const head = `${board.station ?? board.evaNo}:`;
  const notes = board.notes.length > 0 ? `\n${board.notes.join("\n")}` : "";
  return rows.length === 0 ? `${head} ${L(language, "keine Abfahrten im Zeitfenster.", "no departures in the window.")}${notes}` : [head, ...rows].join("\n") + notes;
}

/** Hands the board to the API when the contract has the write operation; a failure is logged, never shown. */
async function storeBoard(ctx: ToolContext, board: DepartureBoard): Promise<void> {
  if (!ctx.api.has(TRAIN_BOARD_WRITE_OPERATION)) return;
  try {
    await ctx.api.post(TRAIN_BOARD_WRITE_OPERATION, {
      evaNo: board.evaNo,
      station: board.station,
      departures: board.departures.map((d) => ({
        line: d.line, category: d.category, destination: d.destination, plannedAt: d.plannedAt.toISOString(), expectedAt: d.expectedAt.toISOString(),
        delayMin: d.delayMin, platform: d.platform, plannedPlatform: d.plannedPlatform, platformChanged: d.platformChanged, cancelled: d.cancelled, evaNo: d.evaNo,
      })),
    });
  } catch (err) {
    log.warn({ error: err instanceof Error ? err.name : "error", reason: redact(String(err)) }, "train board not handed to the API");
  }
}

async function liveBoard(evaNo: string, args: Record<string, unknown>, ctx: ToolContext): Promise<CallToolResult> {
  const { language } = ctx;
  const limit = num(args["limit"]) ?? 10;
  const categories = strs(args["categories"]);
  const when = str(args["when"]);
  const from = when === undefined ? new Date() : new Date(when);
  if (Number.isNaN(from.getTime())) return toolError(L(language, "when ist keine gültige Zeit.", "when is not a valid time."));
  try {
    const board = await fetchDepartureBoard(ctx.trains, evaNo, {
      from, durationMin: num(args["duration_min"]) ?? 60, limit, now: new Date(),
      ...(categories === undefined ? {} : { keep: (d) => d.category !== null && categories.includes(d.category) }),
    });
    await storeBoard(ctx, board);
    return toolResult(boardText(board, language, limit), [{ ...DB_TIMETABLES_META, generatedAt: new Date().toISOString(), asOf: new Date().toISOString() }], language);
  } catch (err) {
    if (err instanceof DbApiError) {
      log.warn({ evaNo, kind: err.kind, reason: redact(err.message) }, "train board failed");
      if (err.kind === "not_found") return toolError(L(language, `Zur EVA-Nummer ${evaNo} kennt DB Timetables keinen Bahnhof.`, `DB Timetables knows no station with EVA number ${evaNo}.`));
      if (err.kind === "rate_limited") return toolError(L(language, "Gerade zu viele Anfragen – bitte in einer Minute noch einmal fragen.", "Too many requests right now – please ask again in a minute."));
      return toolError(L(language, "Die Live-Abfahrten der DB sind gerade nicht erreichbar.", "DB's live departures are not reachable right now."));
    }
    throw err;
  }
}

export const getTrainDepartures: Handler = async (args, ctx) => {
  const { language } = ctx;
  const eva = str(args["eva_no"]);
  if (eva !== undefined && ctx.trains.configured) return liveBoard(eva, args, ctx);
  const name = str(args["station"]);
  if (eva === undefined && name === undefined) return toolError(L(language, "Bitte einen Bahnhof (station) oder eine EVA-Nummer angeben.", "Please give a station or an EVA number."));
  const stations = await ctx.api.get<T.Station[]>("listStations", { code: eva, q: eva === undefined ? name : undefined, limit: 1 });
  const station = stations.data[0];
  if (station === undefined) return toolResult(L(language, "Diesen Bahnhof kenne ich nicht.", "I do not know this station."), [stations.meta], language);
  const r = await ctx.api.get<T.Board>("listStationDepartures", {
    stationId: station.id, from: str(args["when"]), duration_min: num(args["duration_min"]), categories: strs(args["categories"]), modes: ["rail"], limit: num(args["limit"]),
  });
  const rows = r.data.departures.map((d) => `- ${berlinTime(d.plannedAt)} ${d.line ?? d.category ?? ""} → ${d.destination ?? "?"}${d.cancelled ? L(language, " · fällt aus", " · cancelled") : d.delayMin ? ` · +${d.delayMin}` : ""}${d.platform === null ? "" : `${L(language, " · Gl. ", " · pl. ")}${d.platform}`}`);
  const body = rows.length === 0 ? `${r.data.station.name}: ${L(language, "keine Abfahrten im Zeitfenster.", "no departures in the window.")}` : [`${r.data.station.name}:`, ...rows].join("\n");
  return toolResult(body, [stations.meta, r.meta], language);
};
