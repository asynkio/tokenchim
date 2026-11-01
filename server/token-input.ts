import type { DrawRecord } from "../src/contracts.ts";
import type { Token } from "../src/core.ts";
export type LiteralSegment =
  { kind: "text"; text: string } | { kind: "bytes"; hex: string };
export interface TextPart {
  type: "text";
  text: string;
}

/** Decode the original bytes without display markers, trimming or replacement characters. */
export function literalTokenSegments(
  token: Pick<Token, "hex" | "length">,
): LiteralSegment[] {
  if (!/^[0-9a-f]{2}(?: [0-9a-f]{2})*$/i.test(token.hex))
    throw Error("Invalid saved token bytes");
  const bytes = Uint8Array.from(
    token.hex.split(" ").map((h) => parseInt(h, 16)),
  );
  if (bytes.length !== token.length)
    throw Error("Saved token byte length mismatch");
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  const segments: LiteralSegment[] = [];
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
        const text = decoder.decode(bytes.slice(i, i + n));
        const last = segments.at(-1);
        if (last?.kind === "text") last.text += text;
        else segments.push({ kind: "text", text });
        i += n;
        continue;
      } catch {
        /* An invalid sequence remains byte data, never invented text. */
      }
    }
    const hex = b.toString(16).padStart(2, "0").toUpperCase();
    const last = segments.at(-1);
    if (last?.kind === "bytes") last.hex += " " + hex;
    else segments.push({ kind: "bytes", hex });
    i++;
  }
  return segments;
}

export function buildInterpretationInput(record: DrawRecord): TextPart[] {
  const parts: TextPart[] = [
    {
      type: "text",
      text: `词元来源词表：DeepSeek-V3.2；版本 ${record.version}。以下 ID 只属于来源词表，不表示你当前模型的 token ID，也不保证每个原文块在你模型中仍是单个 token。\n元信息与字节说明不是原文。标为原文的独立 text 内容块保留全部原字符、前后空格、换行和控制字符；内容块的边界不是词元内容。`,
    },
  ];
  record.tokens.forEach((t, index) => {
    const segments = literalTokenSegments(t);
    parts.push({
      type: "text",
      text: `\n词元 ${index + 1} 元信息（不是原文）：${JSON.stringify({ id: t.id, type: t.type, grade: t.grade, byteLength: t.length, hex: t.hex, utf8Complete: segments.every((s) => s.kind === "text") })}\n后续是此词元的原文内容块，遇到不可解码字节时会单独说明：\n`,
    });
    for (const segment of segments) {
      parts.push({
        type: "text",
        text:
          segment.kind === "text"
            ? segment.text
            : `\n[字节说明：${segment.hex} 是不可独立解码的 UTF-8 原始字节，不是字面的十六进制文本；此片段没有可发送的 Unicode 原文。]\n`,
      });
    }
  });
  return parts;
}
