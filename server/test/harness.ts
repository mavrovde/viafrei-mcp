import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ElicitRequestSchema, type CallToolResult, type ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import { ApiClient } from "../src/api/client.js";
import { loadCatalogue } from "../src/catalogue.js";
import { createServer } from "../src/server.js";
import type { RefreshWait } from "../src/tools/trains.js";
import { API_BASE } from "./api-mock.js";

export const TEST_KEY = "test-key-not-a-secret";

/** A connected client/server pair over memory. `elicit` set: the client declares elicitation and answers with it. */
export async function connect(o: { elicit?: () => ElicitResult; refreshWait?: RefreshWait } = {}): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createServer({
    api: new ApiClient({ baseUrl: API_BASE, key: TEST_KEY }),
    ...(o.refreshWait === undefined ? {} : { refreshWait: o.refreshWait }),
    catalogue: loadCatalogue(),
  });
  const client = new Client({ name: "test", version: "0" }, { capabilities: o.elicit === undefined ? {} : { elicitation: {} } });
  if (o.elicit !== undefined) {
    const answer = o.elicit;
    client.setRequestHandler(ElicitRequestSchema, async () => answer());
  }
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

export const textOf = (r: unknown): string => ((r as CallToolResult).content[0] as { text: string }).text;
