import { describe, expect, it } from "vitest";
import type { DataMeta } from "../src/api/client.js";
import { checkedStamp } from "../src/presentation.js";

/** Today's checkedAsOfLabel: the last check, and since when the data shown is unchanged. */
const meta = (lastCheckedAt?: string | null): DataMeta => ({
  requestId: "r", generatedAt: "2026-11-25T00:08:38Z", language: "en",
  freshness: [{ family: "other", dataAsOf: null, lastCheckedAt: "2026-11-25T00:01:00Z" }, { family: "dwd_warnings", dataAsOf: "2026-11-24T22:17:39Z", ...(lastCheckedAt === undefined ? {} : { lastCheckedAt }) }],
});
const now = new Date("2026-11-25T00:08:38Z");

describe("checkedStamp", () => {
  it("says the last check, and the day of a change on another day", () => {
    expect(checkedStamp(meta("2026-11-24T23:50:00Z"), "dwd_warnings", "2026-11-24T22:12:00Z", "en", now)).toEqual({ asOf: "2026-11-24T23:50:00Z", asOfLabel: "As of 00:50, unchanged since 2026-11-24 23:12" });
    expect(checkedStamp(meta("2026-11-24T23:50:00Z"), "dwd_warnings", "2026-11-24T22:12:00Z", "de", now)?.asOfLabel).toBe("Stand 00:50, unverändert seit 24.11. 23:12");
  });
  it("says no 'unchanged since' within a minute of the check, nor without a change time", () => {
    expect(checkedStamp(meta("2026-11-25T00:05:00Z"), "dwd_warnings", "2026-11-25T00:04:00.001Z", "en", now)?.asOfLabel).toBe("As of 01:05");
    expect(checkedStamp(meta("2026-11-25T00:05:00Z"), "dwd_warnings", "2026-11-25T00:04:00Z", "en", now)?.asOfLabel).toBe("As of 01:05, unchanged since 01:04");
    expect(checkedStamp(meta("2026-11-25T00:05:00Z"), "dwd_warnings", null, "en", now)?.asOfLabel).toBe("As of 01:05");
  });
  it("is undefined while the API does not say the family's last check", () => {
    expect(checkedStamp(meta(), "dwd_warnings", null, "en", now)).toBeUndefined();
    expect(checkedStamp(meta(null), "dwd_warnings", null, "en", now)).toBeUndefined();
    expect(checkedStamp(meta("2026-11-25T00:05:00Z"), "missing", null, "en", now)).toBeUndefined();
  });
});
