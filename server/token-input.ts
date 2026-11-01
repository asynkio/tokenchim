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
      text: "请仅结合以下编号文字片段作整体释读。",
    },
  ];
  record.tokens.forEach((t, index) => {
    const segments = literalTokenSegments(t);
    parts.push({
      type: "text",
      text: `\n片段 ${index + 1}：\n`,
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
