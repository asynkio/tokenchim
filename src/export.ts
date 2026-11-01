import type { Reading } from "./contracts";
import { tokenParts, type Token } from "./core";
export const colors = {
  N: "#a7b3d0",
  R: "#58d5f5",
  SR: "#bc8bff",
  SSR: "#ffd375",
  UR: "#ff81b0",
};
export async function exportPng(
  tokens: Token[],
  reading?: Reading | null,
): Promise<Blob> {
  await document.fonts.load('27px "TokenChimDot"', "·");
  await document.fonts.ready;
  const c = document.createElement("canvas");
  c.width = 1200;
  const scratch = c.getContext("2d");
  if (!scratch) throw Error("浏览器不支持图片绘制");
  const textFont = "32px sans-serif";
  const codeFont = '27px "TokenChimDot", monospace';
  const wrapped = tokens.map((t) => {
    const lines: { text: string; code: boolean; x: number }[][] = [[]];
    let x = 0;
    for (const part of tokenParts(t)) {
      const code = part.kind !== "text";
      scratch.font = code ? codeFont : textFont;
      for (const ch of part.text) {
        if (ch === "\n") {
          lines.push([]);
          x = 0;
          continue;
        }
        const width = scratch.measureText(ch).width;
        if (x + width > 990) {
          lines.push([]);
          x = 0;
        }
        lines.at(-1)!.push({ text: ch, code, x });
        x += width;
      }
    }
    return lines;
  });
  const heights = wrapped.map((lines) =>
    Math.max(180, lines.length * 44 + 108),
  );
  const readingLines: { text: string; color: string }[] = [];
  if (reading) {
    scratch.font = "28px sans-serif";
    for (const [paragraph, color] of [
      [reading.title, "#d8b8ff"],
      [reading.interpretation, "#eeeaf9"],
      ["宜：" + reading.dos.join(" · "), "#9ce4bd"],
      ["忌：" + reading.donts.join(" · "), "#edbdc3"],
    ]) {
      let line = "";
      for (const ch of paragraph) {
        if (scratch.measureText(line + ch).width > 1020) {
          readingLines.push({ text: line, color });
          line = "";
        }
        line += ch;
      }
      readingLines.push({ text: line, color });
      readingLines.push({ text: "", color });
    }
  }
  const readingHeight = reading ? readingLines.length * 42 + 85 : 0;
  c.height = 240 + heights.reduce((a, b) => a + b + 24, 0) + readingHeight;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0b0e1b";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#fafaff";
  ctx.font = "bold 48px sans-serif";
  ctx.fillText("TokenChim / 词元抽签所", 60, 85);
  ctx.font = "22px sans-serif";
  ctx.fillStyle = "#a7b3d0";
  ctx.fillText("DeepSeek V4.1 Flash · 每个词元，都有它的奇遇", 60, 132);
  let y = 180;
  tokens.forEach((t, i) => {
    ctx.fillStyle = "#141a2c";
    ctx.fillRect(50, y, 1100, heights[i]);
    ctx.fillStyle = colors[t.grade];
    ctx.fillRect(50, y, 4, heights[i]);
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(
      `${t.grade}  /  #${t.id}  /  ${t.length} bytes · ${t.type}`,
      80,
      y + 40,
    );
    ctx.font = "32px sans-serif";
    ctx.fillStyle = "#ffffff";
    wrapped[i].forEach((line, j) =>
      line.forEach((glyph) => {
        ctx.font = glyph.code ? codeFont : textFont;
        ctx.fillStyle = glyph.code ? "#8b849d" : "#ffffff";
        ctx.fillText(glyph.text, 80 + glyph.x, y + 92 + j * 44);
      }),
    );
    y += heights[i] + 24;
  });
  if (reading) {
    ctx.fillStyle = "#141a2c";
    ctx.fillRect(50, y, 1100, readingHeight - 24);
    ctx.font = "28px sans-serif";
    readingLines.forEach((line, i) => {
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, 80, y + 45 + i * 42);
    });
  }
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#a7b3d0";
  ctx.fillText(
    reading
      ? "AI 释读仅作趣味灵感；评级为固定游戏规则。"
      : "评级为固定游戏规则，不代表官方评价或真实词频。",
    60,
    c.height - 24,
  );
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(Error("PNG 导出失败"))),
      "image/png",
    ),
  );
}
export function download(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tokenchim.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
