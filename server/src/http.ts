// The HTTP entrypoint: everything is in `http-server.ts`; a refused configuration prints its reason and exits 2.
import { startHttp } from "./http-server.js";

try {
  startHttp();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
}
