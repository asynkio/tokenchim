import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Dataset } from "../../src/core";
const data: Dataset = JSON.parse(
  readFileSync("public/data/tokens.json", "utf8"),
);
const fragment = (ids: number[]) =>
  "#v=ds-v3.2-a7e62ac&r=rank-v1&ids=" + ids.join(",");
test("desktop empty state, draw lock, ten cards, copy fallback, PNG and ordered restore", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "开启我的词元奇遇" }),
  ).toBeEnabled();
  await expect(page.locator(".sealed")).toHaveCount(3);
  await expect(page.locator(".revealed")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/desktop-empty.png",
    fullPage: true,
  });
  await page.getByRole("combobox").selectOption("10");
  await page.getByRole("button", { name: "开启我的词元奇遇" }).click();
  await expect(page.getByRole("button", { name: "正在召唤…" })).toBeDisabled();
  await expect(page.locator(".revealed")).toHaveCount(10);
  const ids = await page.locator(".token-id").allTextContents();
  expect(new Set(ids).size).toBe(10);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("unavailable")) },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "分享", exact: true }).click();
  const url = await page
    .getByRole("textbox", { name: "分享链接", exact: true })
    .inputValue();
  await page.goto(url);
  await expect(page.locator(".revealed")).toHaveCount(10);
  expect(await page.locator(".token-id").allTextContents()).toEqual(ids);
  await page.getByRole("button", { name: "分享", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "保存图片（PNG）" }).click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = readFileSync(path!);
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(bytes.readUInt32BE(16)).toBe(1200);
  await download.saveAs("test-results/cards.png");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "更多分享方式" }).click();
  await expect(page.locator(".share-error")).toContainText("不支持系统分享");
});
test("mobile, reduced motion, keyboard details, unusual text and long token", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const special = data.tokens.find((t) => t.type === "控制标记")!;
  const chinese = data.tokens.find(
    (t) => /[中]/.test(t.text) && t.type === "普通",
  )!;
  const invalid = data.tokens.find((t) => t.hex === "a1")!;
  const longest = data.tokens.reduce((a, b) => (a.length > b.length ? a : b));
  await page.goto(
    "/" + fragment([special.id, chinese.id, invalid.id, longest.id]),
  );
  await expect(page.locator(".revealed")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await expect(page.locator(".token-text").nth(2)).toHaveText(invalid.text);
  await expect(page.locator(".token-text").nth(2).locator("code")).toHaveText(
    "A1",
  );
  expect(
    await page
      .locator(".token-text code")
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("monospace");
  const card = page.locator(".revealed").first();
  await card.focus();
  await expect(card).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Enter");
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(card).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Space");
  await expect(card).toHaveAttribute("aria-pressed", "true");
  expect(
    await card
      .locator(".card-flipper")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  expect(
    await page
      .locator(".revealed")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.screenshot({
    path: "test-results/mobile-results.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "游戏规则" }).click();
  await expect(page).toHaveURL(/rules\.html$/);
  await page.locator(".method summary").click();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await page.screenshot({
    path: "test-results/rules-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("invalid links and loading failure retry", async ({ page }) => {
  await page.goto("/" + fragment([1, 1]));
  await expect(page.getByRole("alert")).toContainText("重复");
  await expect(page.locator(".revealed")).toHaveCount(0);
  await page.route("**/data/tokens.json", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("加载");
  await expect(page.locator(".summon")).toBeDisabled();
  await page.unroute("**/data/tokens.json");
  await page.getByRole("button", { name: "重新加载" }).click();
  await expect(
    page.getByRole("button", { name: "开启我的词元奇遇" }),
  ).toBeEnabled();
});
test("share auto-copy, text copy, retry, system share and cancellation", async ({
  page,
}) => {
  await page.goto("/" + fragment([0, 525, 997]));
  await expect(page.locator(".revealed")).toHaveCount(3);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          const w = window as unknown as { copies: string[] };
          (w.copies ??= []).push(text);
        },
      },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "分享", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "分享抽卡结果" });
  await expect(dialog).toBeVisible();
  await expect(page.locator(".share-feedback")).toHaveCount(0);
  await expect(page.locator(".share-trigger svg")).toHaveCount(1);
  for (const button of await dialog.getByRole("button").all())
    await expect(button.locator("svg")).toHaveCount(1);
  await expect(page.locator(".share-primary svg")).toHaveClass(/lucide-check/);
  await expect(page.locator(".share-primary")).toHaveCSS(
    "color",
    "rgb(184, 245, 208)",
  );
  await expect(page.locator(".share-primary")).toHaveText("链接已复制");
  await expect(page.locator(".share-primary")).toHaveClass(/is-copied/);
  const url = await page
    .getByRole("textbox", { name: "分享链接", exact: true })
    .inputValue();
  expect(url).toContain("ids=0%2C525%2C997");
  await page.setViewportSize({ width: 700, height: 900 });
  expect(
    await page.evaluate(
      () => (window as unknown as { copies: string[] }).copies.length,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "复制结果文本", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "文本已复制", exact: true }),
  ).toHaveClass(/is-copied/);
  await expect(page.locator(".share-primary")).not.toHaveClass(/is-copied/);
  const text = await page.evaluate(() =>
    (window as unknown as { copies: string[] }).copies.at(-1),
  );
  expect(text).toContain("中 · #525 · N");
  expect(text).toContain("我的 TokenChim 抽卡结果");
  expect(text).toContain(url);
  await page.getByRole("button", { name: "复制分享链接", exact: true }).click();
  await expect(page.locator(".share-primary")).toHaveText("链接已复制");
  await expect(page.locator(".share-primary")).toHaveClass(/is-copied/);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      value: async (payload: ShareData) => {
        (window as unknown as { shared: ShareData }).shared = payload;
      },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "更多分享方式" }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { shared: ShareData }).shared.url,
    ),
  ).toBe(url);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      value: async () => {
        throw new DOMException("cancelled", "AbortError");
      },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "更多分享方式" }).click();
  await expect(page.locator(".share-error")).toHaveCount(0);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      value: async () => {
        throw Error("unavailable");
      },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "更多分享方式" }).click();
  await expect(page.getByRole("alert")).toContainText("系统分享不可用");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "分享", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "分享", exact: true }).click();
  await expect(page.locator(".share-primary")).toHaveText("链接已复制");
  await expect(page.locator(".share-primary")).toHaveClass(/is-copied/);
  expect(
    await page.evaluate(
      () => (window as unknown as { copies: string[] }).copies.length,
    ),
  ).toBe(4);
});

test("whitespace and byte markers use muted code rendering", async ({
  page,
}) => {
  await page.goto("/" + fragment([223, 24615, 201, 191]));
  await expect(page.locator(".revealed")).toHaveCount(4);
  const dotWidth = await page.evaluate(async () => {
    await document.fonts.load('100px "TokenChimDot"', "·");
    if (!document.fonts.check('100px "TokenChimDot"', "·"))
      throw Error("Embedded font did not load");
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = '100px "TokenChimDot"';
    return ctx.measureText("·").width;
  });
  expect(dotWidth).toBeGreaterThan(59);
  expect(dotWidth).toBeLessThan(61);
  const values = ["·", "91 9C", "↵", "00"];
  for (let i = 0; i < values.length; i++) {
    const code = page.locator(".token-text").nth(i).locator("code");
    await expect(code).toHaveText(values[i]);
    await expect(code).toHaveCSS("color", "rgb(139, 132, 157)");
  }
  await page.screenshot({
    path: "test-results/marker-rendering.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "分享", exact: true }).click();
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "保存图片（PNG）" }).click(),
  ]);
  await file.saveAs("test-results/marker-cards.png");
});

test("minimal home, unpadded IDs, click flip and rules navigation", async ({
  page,
}) => {
  await page.goto("/" + fragment([0, 525, 24615]));
  await expect(page.locator(".token-id").first()).toHaveText("#0");
  await expect(page.locator(".token-id").nth(1)).toHaveText("#525");
  await expect(
    page.locator(
      ".card details, .status, .control-note, .rules, .rarity-strip",
    ),
  ).toHaveCount(0);
  await expect(page.locator(".token-meta").first()).toHaveText("29 BYTES");
  const card = page.locator(".revealed").first();
  await card.hover();
  await expect(card).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".flip-hint")).toHaveCount(1);
  await expect(page.locator(".flip-hint")).toContainText(
    "点击卡片翻面查看详情，再次点击返回",
  );
  await expect(card.locator(".flip-hint")).toHaveCount(0);
  await expect(card).toHaveCSS("border-top-width", "0px");
  await expect(card).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(card.locator(".card-front")).toHaveCSS(
    "border-top-width",
    "1px",
  );
  await expect(card.locator(".card-back")).toHaveCSS("border-top-width", "1px");
  const before = await card.boundingBox();
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await expect(card.locator(".card-back")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await expect(card.locator(".byte-details")).toContainText("官方 special");
  await expect(card.locator(".card-flipper")).toHaveCSS(
    "transform-style",
    "preserve-3d",
  );
  const after = await card.boundingBox();
  expect(after!.height).toBeCloseTo(before!.height, 0);
  await page.screenshot({
    path: "test-results/desktop-flip.png",
    fullPage: true,
    animations: "disabled",
  });
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".token-popover")).toHaveCount(0);
  await page.getByRole("link", { name: "游戏规则" }).click();
  await expect(page.locator(".rules")).toBeVisible();
  await expect(page.locator(".cards")).toHaveCount(0);
  await page.getByRole("link", { name: "返回抽卡" }).click();
  await expect(page.locator(".sealed")).toHaveCount(3);
});

test("touch flips in place, stays flipped on outside tap, and long details scroll", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const longest = data.tokens.reduce((a, b) => (a.length > b.length ? a : b));
  await page.goto("http://127.0.0.1:5173/" + fragment([longest.id, 24615]));
  const card = page.locator(".revealed").first();
  await expect(card).toHaveAttribute("aria-pressed", "false");
  await card.tap();
  await expect(card).toHaveAttribute("aria-pressed", "true");
  const detail = card.locator(".byte-details");
  expect(
    await detail.evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBeTruthy();
  await detail.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.screenshot({
    path: "test-results/mobile-flip.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.locator("h1").tap();
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await card.locator(".details-title").tap();
  await expect(card).toHaveAttribute("aria-pressed", "false");
  await context.close();
});

test("centered summon, desktop popover, mobile drawer and clipboard fallbacks", async ({
  page,
}) => {
  await page.goto("/" + fragment([223, 24615, 201]));
  await expect(page.locator(".revealed")).toHaveCount(3);
  const trigger = page.getByRole("button", { name: "分享", exact: true });
  for (const width of [1280, 800, 760, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const [summon, controls, share] = await Promise.all([
      page.locator(".summon").boundingBox(),
      page.locator(".controls").boundingBox(),
      trigger.boundingBox(),
    ]);
    expect(
      Math.abs(
        summon!.x + summon!.width / 2 - controls!.x - controls!.width / 2,
      ),
    ).toBeLessThan(1);
    expect(share!.x).toBeGreaterThanOrEqual(summon!.x + summon!.width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    }),
  );
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(page.getByRole("alert")).toContainText("自动复制未成功");
  await expect(page.locator(".share-primary")).not.toHaveClass(/is-copied/);
  await expect(
    page.getByRole("button", { name: "复制分享链接", exact: true }),
  ).toBeFocused();
  const link = page.getByRole("textbox", { name: "分享链接", exact: true });
  await link.focus();
  expect(
    await link.evaluate(
      (e: HTMLTextAreaElement) => e.selectionEnd - e.selectionStart,
    ),
  ).toBe((await link.inputValue()).length);
  await page.getByRole("button", { name: "复制结果文本", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "手动复制结果文本" }),
  ).toContainText("91 9C · #24615");
  await page.screenshot({
    path: "test-results/share-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      const r = await dialog.boundingBox();
      return Math.abs(r!.y + r!.height - 844);
    })
    .toBeLessThan(0.5);
  const box = await dialog.boundingBox();
  expect(box!.x).toBe(0);
  expect(box!.width).toBe(390);
  expect(box!.y + box!.height).toBeCloseTo(844, 0);
  await page.screenshot({
    path: "test-results/share-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "关闭分享面板" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(4, 4);
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await page.evaluate(() => {
    location.hash = "#v=ds-v3.2-a7e62ac&r=rank-v1&ids=525";
  });
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".revealed")).toHaveCount(1);
});

test("modal focus, reduced motion, PNG failure retry and stale copy completion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/" + fragment([525, 24615]));
  await expect(page.locator(".revealed")).toHaveCount(2);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: () =>
          new Promise<void>((resolve) => {
            (window as unknown as { finishCopy: () => void }).finishCopy =
              resolve;
          }),
      },
      configurable: true,
    }),
  );
  const trigger = page.getByRole("button", { name: "分享", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCSS("animation-name", "none");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { finishCopy: () => void }).finishCopy(),
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw Error("denied");
        },
      },
      configurable: true,
    }),
  );
  await trigger.click();
  await expect(page.getByRole("alert")).toContainText("自动复制未成功");
  await expect(page.locator(".share-primary")).not.toHaveClass(/is-copied/);
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBeTruthy();
  }
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = (callback) => callback(null);
  });
  await page.getByRole("button", { name: "保存图片（PNG）" }).click();
  await expect(page.getByRole("alert")).toHaveText("图片生成失败，请重试");
  await expect(
    page.getByRole("button", { name: "保存图片（PNG）" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "关闭分享面板" }).click();
  await expect(trigger).toBeFocused();
});
