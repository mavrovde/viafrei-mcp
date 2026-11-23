/**
 * The parts of the per-address limit and of readiness that need no socket: who a request is from, the
 * bucket it is counted in, the limiter's arithmetic, and the readiness answer under its deadline.
 */
import { describe, expect, it } from "vitest";
import { bucketKey, clientIp, parseTrustedProxies } from "../../src/client-ip.js";
import { IpLimiter } from "../../src/ip-limit.js";
import { createReadiness } from "../../src/readiness.js";

describe("clientIp — whose bucket a request is counted in", () => {
  const bridge = parseTrustedProxies("172.16.0.0/12");

  it("is the socket peer when the peer is not a trusted proxy, whatever the header claims", () => {
    expect(clientIp("203.0.113.7", "198.51.100.1", bridge)).toEqual({ kind: "client", ip: "203.0.113.7", forwardedIgnored: true });
    expect(clientIp("::ffff:203.0.113.7", undefined, bridge)).toEqual({ kind: "client", ip: "203.0.113.7" });
  });

  it("is the LAST hop of X-Forwarded-For when a trusted proxy forwarded it — never the first, which the client wrote", () => {
    expect(clientIp("::ffff:172.18.0.1", "198.51.100.1, 203.0.113.9", bridge)).toEqual({ kind: "client", ip: "203.0.113.9" });
    expect(clientIp("172.18.0.1", ["198.51.100.1", "2001:db8::5"], bridge)).toEqual({ kind: "client", ip: "2001:db8::5" });
  });

  it("is UNATTRIBUTED when a trusted proxy names nobody — so it is not counted in the proxy's one shared bucket", () => {
    expect(clientIp("172.18.0.1", undefined, bridge)).toEqual({ kind: "unattributed" });
    expect(clientIp("172.18.0.1", "not-an-address", bridge)).toEqual({ kind: "unattributed" });
  });

  it("flags an UNtrusted peer that sent X-Forwarded-For — the header is ignored, and the caller must be told once", () => {
    expect(clientIp("192.168.16.1", "203.0.113.9", bridge)).toEqual({ kind: "client", ip: "192.168.16.1", forwardedIgnored: true });
    expect(clientIp("192.168.16.1", "  ", bridge)).toEqual({ kind: "client", ip: "192.168.16.1" });
  });

  it("knows nothing about a request with no peer", () => {
    expect(clientIp(undefined, "203.0.113.9", bridge)).toBeNull();
  });

  it("refuses a malformed trust list at boot rather than dropping an entry", () => {
    expect(() => parseTrustedProxies("172.16.0.0/12, nonsense")).toThrow(/MCP_TRUSTED_PROXY_CIDR: "nonsense"/);
    expect(() => parseTrustedProxies("10.0.0.0/33")).toThrow(/not an address or CIDR/);
    expect(() => parseTrustedProxies("")).not.toThrow();
    expect(parseTrustedProxies("127.0.0.1").check("127.0.0.1", "ipv4")).toBe(true);
  });

  // A second proxy (an ingress) APPENDS its own peer, so the last hop is always a proxy.
  const twoHops = parseTrustedProxies("127.0.0.1/32, 192.0.2.0/24");
  it("behind the edge and an ingress, the client is the rightmost hop no trusted proxy is (two hops)", () => {
    expect(clientIp("192.0.2.17", "203.0.113.9, 192.0.2.1", twoHops)).toEqual({ kind: "client", ip: "203.0.113.9" });
    expect(clientIp("192.0.2.17", "203.0.113.9, 127.0.0.1, 192.0.2.1", twoHops)).toEqual({ kind: "client", ip: "203.0.113.9" });
    // two visitors behind the same gateway are two buckets, not one
    expect(clientIp("192.0.2.17", "198.51.100.4, 192.0.2.1", twoHops)).toEqual({ kind: "client", ip: "198.51.100.4" });
  });

  it("a forged left hop is never reached: the walk stops at the first untrusted hop", () => {
    expect(clientIp("192.0.2.17", "192.0.2.99, 203.0.113.9, 192.0.2.1", twoHops)).toEqual({ kind: "client", ip: "203.0.113.9" });
    expect(clientIp("192.0.2.17", "198.51.100.1, 203.0.113.9, 192.0.2.1", twoHops)).toEqual({ kind: "client", ip: "203.0.113.9" });
  });

  it("every hop a proxy is the leftmost; an unparsable hop on the way is no client", () => {
    expect(clientIp("192.0.2.17", "192.0.2.33, 192.0.2.1", twoHops)).toEqual({ kind: "client", ip: "192.0.2.33" });
    expect(clientIp("192.0.2.17", "203.0.113.9, junk, 192.0.2.1", twoHops)).toEqual({ kind: "unattributed" });
  });
});

describe("bucketKey — IPv4 per address, IPv6 per /64", () => {
  it("keeps an IPv4 address as its own key", () => {
    expect(bucketKey("203.0.113.7")).toBe("203.0.113.7");
  });

  it("files every address of one /64 under one key, whatever its spelling", () => {
    const k = bucketKey("2001:db8:1:2::a");
    expect(k).toBe("2001:db8:1:2::/64");
    for (const same of ["2001:db8:1:2:ffff:ffff:ffff:ffff", "2001:0db8:0001:0002:0000:0000:0000:0001", "2001:DB8:1:2::1"]) expect(bucketKey(same), same).toBe(k);
    expect(bucketKey("2001:db8:1:3::a"), "the next /64 is another holder").not.toBe(k);
  });

  it("handles the compressed corners and an embedded dotted quad", () => {
    expect(bucketKey("::1")).toBe("0:0:0:0::/64");
    expect(bucketKey("2001:db8::")).toBe("2001:db8:0:0::/64");
    expect(bucketKey("64:ff9b::192.0.2.1")).toBe("64:ff9b:0:0::/64");
  });
});

describe("IpLimiter", () => {
  it("caps the requests ONE address has running at once, and a release frees the slot exactly once", () => {
    const l = new IpLimiter({ maxInflight: 2, ratePerMin: 0, burst: 1 });
    const a = l.admit("203.0.113.1");
    const b = l.admit("203.0.113.1");
    expect(a.ok && b.ok).toBe(true);
    const c = l.admit("203.0.113.1");
    expect(c).toEqual({ ok: false, reason: "inflight", retryAfterS: 1 });
    // Another address is not affected by the first one's load.
    expect(l.admit("203.0.113.2").ok).toBe(true);
    if (a.ok) { a.release(); a.release(); }
    expect(l.inflight("203.0.113.1"), "a double release must not hand back a slot that was never paid for").toBe(1);
    expect(l.admit("203.0.113.1").ok).toBe(true);
  });

  it("refills its token bucket over time and names how long to wait", () => {
    let now = 0;
    const l = new IpLimiter({ maxInflight: 0, ratePerMin: 60, burst: 3, now: () => now });
    for (let i = 0; i < 3; i += 1) expect(l.admit("203.0.113.1").ok).toBe(true);
    const refused = l.admit("203.0.113.1");
    expect(refused).toEqual({ ok: false, reason: "rate", retryAfterS: 1 });
    now += 1_000; // one token per second at 60/min
    expect(l.admit("203.0.113.1").ok).toBe(true);
    expect(l.admit("203.0.113.1").ok).toBe(false);
  });

  it("does not let a stream occupy an in-flight slot — opening one costs a token, holding it costs nothing", () => {
    const l = new IpLimiter({ maxInflight: 1, ratePerMin: 0, burst: 1 });
    for (let i = 0; i < 5; i += 1) expect(l.admit("203.0.113.1", false).ok).toBe(true);
    expect(l.inflight("203.0.113.1")).toBe(0);
    expect(l.admit("203.0.113.1").ok).toBe(true);
  });

  it("prunes idle, full buckets so the map cannot grow without bound", () => {
    let now = 0;
    const l = new IpLimiter({ maxInflight: 4, ratePerMin: 60, burst: 2, now: () => now });
    const busy = l.admit("203.0.113.1");
    l.admit("203.0.113.2", false); // a stream opening: a token, no slot
    expect(l.size).toBe(2);
    now += 10_000;
    expect(l.prune(), "only the address with nothing running and a full bucket goes").toBe(1);
    expect(l.size).toBe(1);
    if (busy.ok) busy.release();
    now += 10_000;
    expect(l.prune()).toBe(1);
    expect(l.size).toBe(0);
  });
});

describe("readiness", () => {
  it("answers ok when the API's readiness returns inside the deadline, and logs nothing", async () => {
    const warned: unknown[] = [];
    const ready = createReadiness({ ping: () => Promise.resolve(), deadlineMs: 1_000, warn: (f) => warned.push(f) });
    expect(await ready()).toBe("ok");
    expect(warned).toEqual([]);
  });

  it("answers SLOW at the deadline — it does not wait for a stalled API — and logs the state", async () => {
    const warned: { fields: Record<string, unknown>; message: string }[] = [];
    const ready = createReadiness({
      ping: () => new Promise(() => undefined),
      deadlineMs: 50,
      warn: (fields, message) => warned.push({ fields, message }),
    });
    const t0 = Date.now();
    expect(await ready()).toBe("slow");
    expect(Date.now() - t0).toBeLessThan(500);
    expect(warned[0]?.fields).toMatchObject({ state: "slow" });
  });

  it("answers DEGRADED when the API refuses, which is a different fact from slow", async () => {
    const ready = createReadiness({ ping: () => Promise.reject(new Error("ECONNREFUSED")), deadlineMs: 1_000 });
    expect(await ready()).toBe("degraded");
  });

  it("writes at most one warn line per window, and the next line carries how many it folded in", async () => {
    let now = 0;
    const warned: Record<string, unknown>[] = [];
    const ready = createReadiness({ ping: () => Promise.reject(new Error("down")), deadlineMs: 1_000, warnEveryMs: 10_000, now: () => now, warn: (f) => warned.push(f) });
    for (let i = 0; i < 5; i += 1) expect(await ready()).toBe("degraded");
    expect(warned).toHaveLength(1);
    expect(warned[0]).toMatchObject({ suppressed: 0 });
    now += 9_999;
    await ready();
    expect(warned).toHaveLength(1);
    now += 1;
    await ready();
    expect(warned).toHaveLength(2);
    expect(warned[1]).toMatchObject({ state: "degraded", suppressed: 5 });
  });

  it("runs ONE statement for any number of concurrent probes — a probe flood cannot queue a pile on its connection", async () => {
    let pings = 0;
    let finish: () => void = () => undefined;
    const ready = createReadiness({ ping: () => { pings += 1; return new Promise<void>((r) => { finish = r; }); }, deadlineMs: 1_000 });
    const answers = Promise.all([ready(), ready(), ready(), ready()]);
    finish();
    expect(await answers).toEqual(["ok", "ok", "ok", "ok"]);
    expect(pings).toBe(1);
    // …and the next probe after it settled runs a fresh statement.
    const again = ready();
    finish();
    expect(await again).toBe("ok");
    expect(pings).toBe(2);
  });
});
