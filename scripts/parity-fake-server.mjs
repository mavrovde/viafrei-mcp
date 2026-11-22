#!/usr/bin/env node
/**
 * A stdio MCP server for parity-mcp.test.mjs: it lists the tools of a JSON file and answers
 * each call with the result stored under its tool and arguments (canonical JSON), or with a
 * protocol error when none is stored.
 *
 *   node scripts/parity-fake-server.mjs <answers.json>
 *   answers.json: { "tools": ["a", …], "answers": { "<tool> <canonical args>": <CallToolResult> } }
 */
import { readFileSync } from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export const keyOf = (tool, args) => `${tool} ${JSON.stringify(Object.fromEntries(Object.entries(args ?? {}).sort(([a], [b]) => a.localeCompare(b))))}`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const spec = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const server = new Server({ name: "parity-fake", version: "1" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: spec.tools.map((name) => ({ name, inputSchema: { type: "object" } })) }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const hit = spec.answers[keyOf(req.params.name, req.params.arguments)];
    if (hit === undefined) throw new Error(`no stored answer for ${keyOf(req.params.name, req.params.arguments)}`);
    return hit;
  });
  await server.connect(new StdioServerTransport());
}
