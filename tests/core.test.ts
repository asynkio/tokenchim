import { formatResultText } from "../src/share.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  displayBytes,
  displayParts,
  rankTokens,
  draw,
  randomBelow,
  encodeShare,
  decodeShare,
  type Dataset,
} from "../src/core.ts";
const d: Dataset = JSON.parse(readFileSync("public/data/tokens.json", "utf8"));
const tokens = d.tokens;
test("pinned official source, merged IDs, classifications and byte integrity", () => {
  const hash = createHash("sha256")
    .update(readFileSync("vendor/tokenizer.json"))
    .digest("hex");
  assert.equal(
    hash,
    "cd050be35cae877f8f0aa847f45aa87e23835a56ca32b29b28545597852784e5",
  );
  assert.equal(hash, d.sha256);
  assert.equal(tokens.length, 128815);
  assert.equal(new Set(tokens.map((t) => t.id)).size, 128815);
  assert.equal(tokens.filter((t) => t.type === "普通").length, 127997);
  assert.equal(tokens.filter((t) => t.type === "控制标记").length, 25);
  assert.equal(tokens.filter((t) => t.type === "占位符").length, 793);
  const official = JSON.parse(readFileSync("vendor/tokenizer.json", "utf8"));
  for (const a of official.added_tokens) {
    const t = tokens.find((t) => t.id === a.id)!;
    assert.equal(t.raw, a.content);
    assert.equal(t.special, a.special);
    assert.equal(
      t.hex,
      Buffer.from(a.content).toString("hex").match(/../g)!.join(" "),
    );
  }
  for (const t of tokens) {
    const bytes = Uint8Array.from(t.hex.split(" ").map((h) => parseInt(h, 16)));
    assert.equal(bytes.length, t.length);
    assert.equal(t.text, displayBytes(bytes));
  }
  assert.equal(
    Object.values(d.frequencies).reduce((a, b) => a + b, 0),
    128815,
  );
});
test("display Chinese, leading whitespace, newline, invalid sequences, controls and long text", () => {
  const e = new TextEncoder();
  for (const [a, b] of [
    ["中文", "中文"],
    [" hello", "·hello"],
    ["\n", "↵\n"],
    ["\t\r", "⇥␍"],
    ["\0", "00"],
    ["<script>", "<script>"],
    ["a".repeat(500), "a".repeat(500)],
  ])
    assert.equal(displayBytes(e.encode(a)), b);
  assert.equal(displayBytes(Uint8Array.of(0xe4, 0xb8)), "E4 B8");
  assert.equal(displayBytes(Uint8Array.of(0xff, 65)), "FFA");
  assert.equal(displayBytes(Uint8Array.of(0xed, 0xa0, 0x80)), "ED A0 80");
  assert.equal(displayBytes(e.encode("�")), "�");
  assert.equal(displayBytes(e.encode("\uFEFF")), "EF BB BF");
  assert.equal(displayBytes(e.encode("\u00a0")), "C2 A0");
  assert.equal(displayBytes(e.encode("\u200b")), "E2 80 8B");
});
test("rating is reproducible, exact cumulative boundaries and ID tiebreak", () => {
  assert.deepEqual(d.counts, {
    N: 64791,
    R: 38399,
    SR: 19200,
    SSR: 6400,
    UR: 25,
  });
  const cloned = tokens.map((t) => ({ ...t }));
  rankTokens(cloned.reverse());
  const grades = new Map(cloned.map((t) => [t.id, t.grade]));
  for (const t of tokens) assert.equal(grades.get(t.id), t.grade);
  const normal = tokens.filter((t) => t.type === "普通");
  assert.equal(
    normal.filter((t) => t.grade === "N").length,
    Math.floor(127997 * 0.5),
  );
  const freq = new Map<number, number>();
  for (const t of normal) freq.set(t.length, (freq.get(t.length) || 0) + 1);
  const lengths = [...freq].sort((a, b) => a[0] - b[0]);
  const expected = [...normal].sort((a, b) => {
    const lp = (t: typeof a) => {
      let before = 0;
      for (const [len, n] of lengths) {
        if (len === t.length) return (before + n / 2) / normal.length;
        before += n;
      }
      return 0;
    };
    return (
      (0.65 * (a.id - b.id)) / (normal.length - 1) + 0.35 * (lp(a) - lp(b)) ||
      a.id - b.id
    );
  });
  expected.forEach((t, i) =>
    assert.equal(
      t.grade,
      i < 63998 ? "N" : i < 102397 ? "R" : i < 121597 ? "SR" : "SSR",
    ),
  );
  assert.equal(expected.filter((t) => t.grade === "SSR").length, 6400);
});
test("sampling rejects modulo bias, returns correct counts and supports repeated draws", () => {
  let calls = 0;
  assert.equal(
    randomBelow(10, (a) => {
      a[0] = calls++ === 0 ? 0xffffffff : 19;
    }),
    9,
  );
  assert.equal(calls, 2);
  for (let n = 1; n <= 4; n++)
    for (let i = 0; i < 20; i++) {
      const result = draw(tokens, n);
      assert.equal(result.length, n);
      assert.equal(new Set(result.map((t) => t.id)).size, n);
    }
  assert.throws(() => draw(tokens, 0));
  assert.throws(() => draw(tokens, 5));
  assert.throws(() => draw(tokens, 2.5));
});
test("share preserves order and validates incompatible, repeated, absent and malformed IDs", () => {
  const ids = [128814, 0, 2048];
  assert.deepEqual(
    decodeShare(encodeShare(ids), tokens).map((t) => t.id),
    ids,
  );
  for (const hash of [
    "#v=old&r=rank-v1&ids=1",
    encodeShare([1, 1]),
    encodeShare([999999]),
    encodeShare([]),
    encodeShare(Array.from({ length: 11 }, (_, i) => i)),
    encodeShare([1.5]),
    "#ids=1",
  ])
    assert.throws(() => decodeShare(hash, tokens));
});

test("render segments distinguish literal text from whitespace and byte markers", () => {
  assert.deepEqual(displayParts(Uint8Array.of(0x91, 0x9c)), [
    { kind: "bytes", text: "91 9C" },
  ]);
  assert.deepEqual(displayParts(new TextEncoder().encode(" ·\\x91\n\t\0")), [
    { kind: "marker", text: "·" },
    { kind: "text", text: "·\\x91" },
    { kind: "marker", text: "↵\n⇥" },
    { kind: "bytes", text: "00" },
  ]);
});

test("result text uses visible token text, unpadded IDs, ordered grades and URL", () => {
  const selected = [525, 223, 24615, 201].map((id) =>
    tokens.find((t) => t.id === id)!,
  );
  assert.equal(
    formatResultText(selected, "https://example.test/#result"),
    "我的 TokenChim 抽卡结果\n中 · #525 · N\n· · #223 · N\n91 9C · #24615 · N\n↵ · #201 · N\n\nhttps://example.test/#result",
  );
});
