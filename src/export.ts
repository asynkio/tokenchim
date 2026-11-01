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
  await document.fonts.load('72px "TokenChimDot"', "·");
  await document.fonts.ready;
  const light = document.documentElement.dataset.theme === "light";
  const palette: Record<string, string> = light
    ? {
        "#0b0e1b": "#f6f4fb",
        "#fafaff": "#282237",
        "#a7b3d0": "#62536f",
        "#141a2c": "#fffdff",
        "#ffffff": "#352744",
        "#8b849d": "#766780",
        "#d8b8ff": "#76519e",
        "#eeeaf9": "#352744",
        "#9ce4bd": "#27724c",
        "#edbdc3": "#a23d56",
      }
    : {};
  const ink = (color: string) => palette[color] ?? color;
  const accent = (grade: Token["grade"]) => {
    if (!light) return colors[grade];
    const base = [36, 19, 50];
    return (
      "rgb(" +
      base
        .map((value, i) =>
          Math.round(
            value * 0.4 +
              parseInt(colors[grade].slice(1 + i * 2, 3 + i * 2), 16) * 0.6,
          ),
        )
        .join(",") +
      ")"
    );
  };
  const c = document.createElement("canvas");
  c.width = 1200;
  const scratch = c.getContext("2d");
  if (!scratch) throw Error("浏览器不支持图片绘制");
  // Render at 3× a 400px share card: type stays legible at phone width.
  const textFont = '600 84px "Space Grotesk", "Noto Sans SC", sans-serif';
  const codeFont = '72px "TokenChimDot", monospace';
  const contentWidth = 992;
  const lineHeight = 112;
  const wrapped = tokens.map((t) => {
    const lines: { text: string; code: boolean; x: number; width: number }[][] =
      [[]];
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
        if (x + width > contentWidth) {
          lines.push([]);
          x = 0;
        }
        lines.at(-1)!.push({ text: ch, code, x, width });
        x += width;
      }
    }
    return lines;
  });
  const heights = wrapped.map((lines) =>
    Math.max(320, lines.length * lineHeight + 192),
  );
  const readingLines: {
    text: string;
    color: string;
    font: string;
    height: number;
  }[] = [];
  if (reading) {
    for (const [paragraph, color, font, height] of [
      [reading.title, "#d8b8ff", '600 56px "Noto Sans SC", sans-serif', 82],
      [
        reading.interpretation,
        "#eeeaf9",
        '44px "Noto Sans SC", sans-serif',
        76,
      ],
      [
        "宜：" + reading.dos.join(" · "),
        "#9ce4bd",
        '42px "Noto Sans SC", sans-serif',
        70,
      ],
      [
        "忌：" + reading.donts.join(" · "),
        "#edbdc3",
        '42px "Noto Sans SC", sans-serif',
        70,
      ],
    ] as const) {
      scratch.font = font;
      let line = "";
      for (const ch of paragraph) {
        if (
          ch === "\n" ||
          scratch.measureText(line + ch).width > contentWidth
        ) {
          readingLines.push({ text: line, color, font, height });
          line = "";
          if (ch === "\n") continue;
        }
        line += ch;
      }
      readingLines.push({ text: line, color, font, height });
      readingLines.push({ text: "", color, font, height: 30 });
    }
  }
  const readingHeight = reading
    ? readingLines.reduce((sum, line) => sum + line.height, 0) + 108
    : 0;
  c.height =
    292 + heights.reduce((a, b) => a + b + 28, 0) + readingHeight + 148;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = ink("#0b0e1b");
  ctx.fillRect(0, 0, c.width, c.height);
  const glow = ctx.createRadialGradient(1050, 0, 0, 1050, 0, 1000);
  glow.addColorStop(0, light ? "#c8afe733" : "#9d6fdb20");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, c.width, c.height);
  function panel(y: number, height: number, border: string) {
    ctx.beginPath();
    ctx.roundRect(48, y, 1104, height, 30);
    ctx.fillStyle = ink("#141a2c");
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = ink("#d8b8ff");
  ctx.font = '600 58px "Space Grotesk", sans-serif';
  ctx.fillText("✦ TokenChim", 64, 108);
  ctx.fillStyle = ink("#fafaff");
  ctx.font = '500 40px "Noto Sans SC", sans-serif';
  ctx.fillText("词元抽签所", 64, 176);
  ctx.font = '32px "Noto Sans SC", sans-serif';
  ctx.fillStyle = ink("#a7b3d0");
  ctx.fillText("每个词元，都有它的奇遇。", 64, 234);
  let y = 292;
  tokens.forEach((t, i) => {
    const tint = accent(t.grade);
    panel(y, heights[i], light ? "#d5c8e5" : "#3b344d");
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.roundRect(80, y + 32, 10, 42, 5);
    ctx.fill();
    ctx.font = 'bold 40px "Space Grotesk", sans-serif';
    ctx.fillText(t.grade, 108, y + 68);
    ctx.fillStyle = ink("#a7b3d0");
    ctx.font = '30px "Space Grotesk", sans-serif';
    ctx.textAlign = "right";
    ctx.fillText(String(i + 1).padStart(2, "0"), 1104, y + 66);
    ctx.textAlign = "left";
    const textTop =
      y + 104 + (heights[i] - 192 - wrapped[i].length * lineHeight) / 2;
    wrapped[i].forEach((line, j) => {
      const last = line.at(-1);
      const width = last ? last.x + last.width : 0;
      const left = (c.width - width) / 2;
      line.forEach((glyph) => {
        ctx.font = glyph.code ? codeFont : textFont;
        ctx.fillStyle = ink(glyph.code ? "#8b849d" : "#ffffff");
        ctx.fillText(glyph.text, left + glyph.x, textTop + 84 + j * lineHeight);
      });
    });
    ctx.fillStyle = tint;
    ctx.font = '36px "Space Grotesk", sans-serif';
    ctx.fillText(`#${t.id}`, 96, y + heights[i] - 34);
    ctx.fillStyle = ink("#a7b3d0");
    ctx.textAlign = "right";
    ctx.font = '32px "Space Grotesk", sans-serif';
    ctx.fillText(`${t.length} BYTES`, 1104, y + heights[i] - 34);
    ctx.textAlign = "left";
    y += heights[i] + 28;
  });
  if (reading) {
    panel(y, readingHeight - 28, light ? "#d5c8e5" : "#3b344d");
    let baseline = y + 86;
    readingLines.forEach((line) => {
      ctx.font = line.font;
      ctx.fillStyle = ink(line.color);
      ctx.fillText(line.text, 104, baseline);
      baseline += line.height;
    });
    y += readingHeight;
  }
  ctx.font = '30px "Noto Sans SC", sans-serif';
  ctx.fillStyle = ink("#a7b3d0");
  ctx.fillText("DeepSeek V4.1 Flash · 评级为固定游戏规则", 64, y + 40);
  ctx.fillText(
    reading ? "AI 释读仅作趣味灵感。" : "不代表官方评价或真实词频。",
    64,
    y + 90,
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
