import { tokenParts, type Token } from "./core";
export function formatResultText(tokens: Token[], url: string): string {
  return [
    "我的 TokenChim 抽卡结果",
    ...tokens.map(
      (t) =>
        `${tokenParts(t)
          .map((p) => p.text)
          .join("")
          .replace(/\n/g, "")} · #${t.id} · ${t.grade}`,
    ),
    "",
    url,
  ].join("\n");
}
