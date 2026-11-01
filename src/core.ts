export const VOCAB_VERSION = "ds-v3.2-a7e62ac";
export const RATING_VERSION = "rank-v1";
export type Grade = "N" | "R" | "SR" | "SSR" | "UR";
export interface Token {
  id: number;
  raw: string;
  text: string;
  hex: string;
  length: number;
  special: boolean;
  type: "普通" | "控制标记" | "占位符";
  grade: Grade;
}
export interface Dataset {
  version: string;
  rating: string;
  sha256: string;
  source: string;
  license: string;
  tokens: Token[];
  counts: Record<Grade, number>;
  frequencies: Record<string, number>;
}
export interface DisplayPart {
  kind: "text" | "marker" | "bytes";
  text: string;
}
export function displayParts(bytes: Uint8Array): DisplayPart[] {
  const parts: DisplayPart[] = [];
  function append(kind: DisplayPart["kind"], text: string) {
    const previous = parts.at(-1);
    if (previous?.kind === kind)
      previous.text += (kind === "bytes" ? " " : "") + text;
    else parts.push({ kind, text });
  }
  const hex = (values: Uint8Array) =>
    Array.from(values, (b) =>
      b.toString(16).padStart(2, "0").toUpperCase(),
    ).join(" ");
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i];
    const n =
      b < 128
        ? 1
        : b >= 194 && b <= 223
          ? 2
          : b >= 224 && b <= 239
            ? 3
            : b >= 240 && b <= 244
              ? 4
              : 0;
    if (n && i + n <= bytes.length) {
      try {
        const chunk = bytes.slice(i, i + n);
        const s = decoder.decode(chunk);
        if (s === " ") append("marker", "·");
        else if (s === "\n") append("marker", "↵\n");
        else if (s === "\r") append("marker", "␍");
        else if (s === "\t") append("marker", "⇥");
        else if (/[\p{Cc}\p{Cf}\p{Zs}\p{Zl}\p{Zp}]/u.test(s))
          append("bytes", hex(chunk));
        else append("text", s);
        i += n;
        continue;
      } catch {
        /* Preserve invalid or incomplete bytes as hexadecimal. */
      }
    }
    append("bytes", hex(bytes.slice(i, i + 1)));
    i++;
  }
  return parts;
}
export function tokenParts(token: Token): DisplayPart[] {
  return displayParts(
    Uint8Array.from(token.hex.split(" ").map((h) => parseInt(h, 16))),
  );
}
export function displayBytes(bytes: Uint8Array): string {
  return displayParts(bytes)
    .map((part) => part.text)
    .join("");
}
export function rankTokens(tokens: Token[]) {
  const normal = tokens
    .filter((t) => t.type === "普通")
    .sort((a, b) => a.id - b.id);
  const freq = new Map<number, number>();
  for (const t of normal) freq.set(t.length, (freq.get(t.length) || 0) + 1);
  let before = 0;
  const percent = new Map<number, number>();
  for (const [len, count] of [...freq].sort((a, b) => a[0] - b[0])) {
    percent.set(len, (before + count / 2) / normal.length);
    before += count;
  }
  const scored = normal
    .map((t, i) => ({
      t,
      score: (i / (normal.length - 1)) * 0.65 + percent.get(t.length)! * 0.35,
    }))
    .sort((a, b) => a.score - b.score || a.t.id - b.t.id);
  scored.forEach(
    ({ t }, i) =>
      (t.grade =
        i < Math.floor(normal.length * 0.5)
          ? "N"
          : i < Math.floor(normal.length * 0.8)
            ? "R"
            : i < Math.floor(normal.length * 0.95)
              ? "SR"
              : "SSR"),
  );
  for (const t of tokens)
    if (t.type !== "普通") t.grade = t.type === "占位符" ? "N" : "UR";
  return tokens;
}
export function randomBelow(
  max: number,
  fill: (a: Uint32Array) => unknown = (a) => crypto.getRandomValues(a),
) {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32)
    throw Error("随机范围无效");
  const a = new Uint32Array(1),
    limit = Math.floor(2 ** 32 / max) * max;
  do {
    fill(a);
  } while (a[0] >= limit);
  return a[0] % max;
}
export function draw(tokens: Token[], count: number) {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 10 ||
    count > tokens.length
  )
    throw Error("抽取数量应为 1–10");
  const picked = new Set<number>();
  while (picked.size < count) picked.add(randomBelow(tokens.length));
  return [...picked].map((i) => tokens[i]);
}
export function encodeShare(ids: number[]) {
  return (
    "#" +
    new URLSearchParams({
      v: VOCAB_VERSION,
      r: RATING_VERSION,
      ids: ids.join(","),
    })
  );
}
export function decodeShare(hash: string, tokens: Token[]) {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  if (p.get("v") !== VOCAB_VERSION || p.get("r") !== RATING_VERSION)
    throw Error("分享链接版本不兼容");
  const raw = p.get("ids") || "";
  if (!/^\d+(,\d+){0,9}$/.test(raw)) throw Error("分享链接数量或格式无效");
  const ids = raw.split(",").map(Number);
  if (new Set(ids).size !== ids.length) throw Error("分享链接包含重复 ID");
  const map = new Map(tokens.map((t) => [t.id, t]));
  return ids.map((id) => {
    const t = map.get(id);
    if (!t) throw Error("分享链接包含不存在的 ID");
    return t;
  });
}
