// The MCP prompts, moved from the ViaFrei platform; comments removed in the move.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetPromptRequestSchema, type GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { normalisePromptArguments } from "./arguments.js";
import { PLACES_PROMPTS } from "./places.js";
import { TRAVEL_PROMPTS } from "./travel.js";
import type { AnyPromptDef } from "./types.js";
export type { AnyPromptDef, PromptDef } from "./types.js";
export const PROMPTS = [...TRAVEL_PROMPTS, ...PLACES_PROMPTS] as const;
export function registerPrompts(server: McpServer): void {
    const catalogue: readonly AnyPromptDef[] = PROMPTS;
    for (const p of catalogue) {
        server.registerPrompt(p.name, { title: p.title, description: p.description, argsSchema: p.shape }, (args): GetPromptResult => ({
            description: p.description,
            messages: [{ role: "user", content: { type: "text", text: p.run(args) } }],
        }));
    }
}
export function readPromptArgumentsFirst(server: McpServer): void {
    const catalogue: readonly AnyPromptDef[] = PROMPTS;
    const handlers = (server.server as unknown as {
        _requestHandlers?: Map<string, (request: unknown, extra: unknown) => Promise<unknown>>;
    })._requestHandlers;
    const sdk = handlers?.get("prompts/get");
    if (sdk === undefined)
        throw new Error("the SDK's prompts/get handler was not found; readPromptArgumentsFirst needs updating for this SDK");
    const shapes = new Map(catalogue.map((p) => [p.name, p.shape] as const));
    server.server.setRequestHandler(GetPromptRequestSchema, async (request, extra) => {
        const shape = shapes.get(request.params.name);
        const args = shape === undefined ? request.params.arguments : normalisePromptArguments(shape, request.params.arguments);
        return (await sdk({ ...request, params: { ...request.params, ...(args === undefined ? {} : { arguments: args }) } }, extra)) as GetPromptResult;
    });
}
