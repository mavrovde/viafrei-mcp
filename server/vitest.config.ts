import { defineConfig } from "vitest/config";

export default defineConfig({ test: { environment: "node", include: ["test/**/*.test.ts"], testTimeout: 20_000, env: { LOG_LEVEL: "silent" } } });
