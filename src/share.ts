import type { Reading } from "./contracts";
import { tokenParts, type Token } from "./core";
export function formatResultText(
  tokens: Token[],
  url: string,
  reading?: Reading | null,
): string {
  return [
    "我的 TokenChim 抽卡结果",
    ...tokens.map(
      (t) =>
        `${tokenParts(t)
          .map((p) => p.text)
          .join("")
          .replace(/\n/g, "")} · #${t.id} · ${t.grade}`,
    ),
    ...(reading
      ? [
          "",
          reading.title,
          reading.interpretation,
          "宜：" + reading.dos.join("、"),
          "忌：" + reading.donts.join("、"),
        ]
      : []),
    "",
    url,
  ].join("\n");
}
