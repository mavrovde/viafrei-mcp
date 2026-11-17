import { createApp } from "./app.js";
import { depsFromEnv } from "./deps.js";
import { log } from "./log.js";

const port = Number(process.env["PORT"] ?? 8_787);
const host = process.env["HOST"] ?? "127.0.0.1";
const server = createApp(depsFromEnv()).listen(port, host, () => log.info({ port, host }, "mcp server listening"));
const stop = (): void => {
  server.close(() => process.exit(0));
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
