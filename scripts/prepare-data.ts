import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  displayBytes,
  rankTokens,
  VOCAB_VERSION,
  RATING_VERSION,
  type Token,
} from "../src/core.ts";
const source =
  "https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017/resolve/1bae0e1088993b9b82de08f59de5be5a34e42170/tokenizer.json";
const raw = readFileSync("vendor/tokenizer.json"),
  sha256 = createHash("sha256").update(raw).digest("hex");
if (
  sha256 !== "c90dfa01249db1be4245780a052ede752e1361c612ac6d08e2bdada7d599476b"
)
  throw Error("Pinned tokenizer SHA-256 mismatch");
const data = JSON.parse(raw.toString());
const bs = Array.from({ length: 256 }, (_, i) => i).filter(
  (b) =>
    (b >= 33 && b <= 126) || (b >= 161 && b <= 172) || (b >= 174 && b <= 255),
);
const cs = [...bs];
let n = 0;
for (let b = 0; b < 256; b++)
  if (!bs.includes(b)) {
    bs.push(b);
    cs.push(256 + n++);
  }
const reverse = new Map(cs.map((c, i) => [String.fromCodePoint(c), bs[i]]));
const map = new Map<number, Token>();
function record(
  id: number,
  raw: string,
  bytes: Uint8Array,
  special: boolean,
  type: Token["type"],
): Token {
  return {
    id,
    raw,
    text: displayBytes(bytes),
    hex: Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" "),
    length: bytes.length,
    special,
    type,
    grade: "N",
  };
}
const addedIds = new Set<number>(
  data.added_tokens.map((t: { id: number }) => t.id),
);
for (const [raw, id] of Object.entries(data.model.vocab) as [
  string,
  number,
][]) {
  if (addedIds.has(id)) continue;
  const bytes = Uint8Array.from(
    Array.from(raw, (c) => {
      const v = reverse.get(c);
      if (v === undefined) throw Error("Unknown ByteLevel character");
      return v;
    }),
  );
  map.set(id, record(id, raw, bytes, false, "普通"));
}
for (const t of data.added_tokens)
  map.set(
    t.id,
    record(
      t.id,
      t.content,
      new TextEncoder().encode(t.content),
      t.special,
      /^(?:<｜place▁holder▁no▁\d+｜>|<\|place_holder_mm_span_\d+\|>)$/.test(
        t.content,
      )
        ? "占位符"
        : "控制标记",
    ),
  );
const tokens = rankTokens([...map.values()].sort((a, b) => a.id - b.id));
const counts = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 },
  frequencies: Record<string, number> = {};
for (const t of tokens) {
  counts[t.grade]++;
  frequencies[t.length] = (frequencies[t.length] || 0) + 1;
}
if (
  tokens.length !== 129280 ||
  tokens.filter((t) => t.type === "占位符").length !== 1221 ||
  counts.UR !== 62
)
  throw Error("Official vocabulary counts changed");
mkdirSync("public/data", { recursive: true });
copyFileSync("vendor/LICENSE", "public/data/LICENSE");
const meta = {
  version: VOCAB_VERSION,
  rating: RATING_VERSION,
  source,
  sha256,
  license: "MIT",
  counts,
  frequencies,
};
writeFileSync("public/data/tokens.json", JSON.stringify({ ...meta, tokens }));
writeFileSync(
  "public/data/provenance.json",
  JSON.stringify(meta, null, 2) + "\n",
);
console.log({ sha256, total: tokens.length, counts });
