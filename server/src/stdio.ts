import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { depsFromEnv } from "./deps.js";
import { createServer } from "./server.js";

await createServer(depsFromEnv()).connect(new StdioServerTransport());
