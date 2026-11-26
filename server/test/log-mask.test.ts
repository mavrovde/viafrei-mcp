import { describe, expect, it } from "vitest";
import { clientKey, KEY_SHAPE, maskLogText } from "../src/log-mask.js";
import { pinned } from "./pinned.js";

// One input per rule and per edge of a rule (documentation addresses and made-up values only), so a changed
// pattern, quote pair or bound shows as a changed line.
const CORPUS = [
  "file:///app/dist/server.js and /app/node_modules/x/dist/y.js and /srv/dist/z",
  "v6 2001:db8::1 full 2001:0db8:0000:0000:0000:ff00:0001:0002 scoped fe80::1%eth0 time 10:20:30 v4 192.0.2.10",
  "id 123e4567-e89b-12d3-a456-426614174000 short 123e4567-e89b-12d3-a456",
  "Authorization: Bearer abc.def-ghi bearer xyz",
  "Cookie: sid=1; x=2\nSet-Cookie: a=b\nnext line",
  "https://alpha.example@alpha.example/path ftp://gamma.example@alpha.example",
  "tok ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123 short ABCDEFGHIJKLMNOPQRSTUVWXYZabcde",
  "b64 /aGVsbG8gd29ybGQgdGhpcyBpcyBiYXNlNjQ+= and /aGVsbG8gd29ybGQgdGhpcyBpcyBiYXNlNjQ",
  "/tools/find-cheapest-fuel-near-a-place-today/AbCdEfGh12345678/abcdefgh12345678/abcd-efgh-1234-5678x/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh",
  "hex 0123456789abcdef01234567 short 0123456789abcdef0123456",
  "q /x?a=1&b=2 lone ? f /x#frag lone #",
  "pt:52.52,13.405 cut pt:52 neg pt:-1.5,-2.25 pair 52.52, 13.40 spaced 52.52 13.40 pi 3.14159 one 2.5",
  "stop de:11000:900100001:1 DE:08001:1000 run 123456 four 1234",
  "'single' \"double\" `tick` „low“ „low2” “high” “high2“ ‘one’ «guil» »rev« open 'never closed",
  "mail someone.x+y@mail.alpha.example not@host",
];

describe("the log mask, rule by rule", () => {
  it("every rule's input, masked, then as a client key", async () => {
    await pinned("log-mask", CORPUS.map((input) => `${JSON.stringify(input)}\n  => ${JSON.stringify(maskLogText(input))}\n  key ${JSON.stringify(clientKey(input))}`).join("\n"));
  });
  it("a key: masked first, then cut to 64 characters of its shape, else none", () => {
    expect(KEY_SHAPE().test("a".repeat(64))).toBe(true);
    expect(KEY_SHAPE().test("a".repeat(65))).toBe(false);
    expect(KEY_SHAPE().test("")).toBe(false);
    expect(clientKey("")).toBeNull();
    expect(clientKey(42)).toBeNull();
    expect(clientKey("ab".repeat(40))).toBe("token");
  });
});
