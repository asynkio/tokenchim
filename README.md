# TokenChim · 词元抽签所

中文响应式 React + TypeScript + Vite 抽卡应用。深色赛博风格，默认抽取 3 个不同 ID 的 token，可选 1–10 个。无需账号、后端或 DeepSeek API。

## 本地运行

```sh
npm ci
npm run dev
```

打开终端提供的本地地址。项目已包含完整预处理词表，运行无需访问 Hugging Face。

```sh
npm test         # 核心数据、评级、抽样、分享测试
npm run build   # TypeScript 检查 + 生产构建
npm run preview # 预览生产构建
```

浏览器回归测试：先执行 `npx playwright install chromium`，再运行 `npm run test:browser`。测试覆盖桌面与移动布局、键盘操作、减少动态效果、分享还原、剪贴板/系统分享降级、PNG 文件及加载重试。

Node.js 22+。生产产物为 `dist/`，首页 `index.html` 与独立规则页 `rules.html` 均可直接静态托管，不需要服务端路由回退。规则页仅加载轻量的来源元数据。可部署到静态托管；若使用子路径，构建时执行 `npm run build -- --base=/your-path/`。本次交付不包含线上部署。分享链接必须使用接收者可访问的站点地址；localhost 链接只适合本机。

## 数据来源与再生成

官方仓库：[deepseek-ai/DeepSeek-V3.2](https://huggingface.co/deepseek-ai/DeepSeek-V3.2)。固定 revision：`a7e62ac04ecb2c0a54d736dc46601c5606cf10a6`。

`vendor/tokenizer.json` 的 SHA-256：`cd050be35cae877f8f0aa847f45aa87e23835a56ca32b29b28545597852784e5`。

词表遵循仓库 MIT 许可证，原文保留于 `vendor/LICENSE` 和 `public/data/LICENSE`。来源、哈希、版本、计数记录在 `public/data/provenance.json`。

```sh
npm run download # 从固定官方 revision 下载 tokenizer.json 与 LICENSE（需要网络）
npm run data     # 验证哈希、逆向 ByteLevel、合并 added tokens、评级并生成离线数据
npm test
```

基础词表 128,000 项，818 个 added tokens，其中 3 个覆盖已有 ID，合并得到 128,815 个唯一 ID。普通 token 逆向 GPT-2 ByteLevel 字节映射；added tokens 直接 UTF-8 编码。保存 ID、原始表示、可见文本、完整十六进制字节、长度、官方 special 标志和应用分类。

## 固定评级规则（rank-v1）

25 个非占位 added tokens 为 UR，793 个占位符为 N。普通 token 共 127,997 项：按 ID 升序得到百分位 `index / (n - 1)`；长度使用经验分布中位百分位 `(更短数量 + 同长度数量 / 2) / n`。综合分 `0.65 × ID 百分位 + 0.35 × 长度百分位`。综合分升序、同分 ID 升序，累计分界 `floor(n × 0.5)`、`floor(n × 0.8)`、`floor(n × 0.95)`。

| 等级 | 完整词表数量 |
| ---- | -----------: |
| N    |       64,791 |
| R    |       38,399 |
| SR   |       19,200 |
| SSR  |        6,400 |
| UR   |           25 |

评级只是固定游戏规则，不代表官方评价、真实词频或价值。每个 ID 抽中概率相同。使用 Web Crypto 和拒绝采样消除取模偏差，一次抽取不重复，不同次可重复。

## 展示与分享

空格显示为 `·`、换行为 `↵` 加真实换行、制表符为 `⇥`、回车为 `␍`；其他空白字符、控制/格式字符和非法或不完整 UTF-8 字节显示为大写十六进制字节（如 `91 9C`）。以上空白符、控制字符和字节标记在卡片中使用较暗的 `<code>` 等宽字体，PNG 使用相同的颜色与等宽样式。字面文本中的 `\x91` 等内容保持原样。卡片背面保留原始文本和字节，桌面与移动端均点按卡片翻面，再次点按返回，所有卡片下方统一显示一条操作提示；边框、背景与内容随整张卡片一起翻转。所有 token 均作为纯文本渲染，不解释为 HTML。

URL fragment 存储词表版本、评级版本、有序 IDs；检查版本、1–10 个数量、重复和 ID 存在性。复制失败时提供可选中输入框；系统分享不支持或失败时提供手动链接和 PNG 下载；取消系统分享不会提示错误。

PNG 使用 Canvas，本地生成，使用卡片相同的文本、逐字符换行、按文本长度增加画布高度，并包含品牌、ID、等级、字节数和类型。页面遵循系统减少动态效果设置，支持键盘聚焦、Enter/空格翻面及 Escape 返回正面。

外部字体为可选增强，网络不可用时回退到系统字体。浏览器剪贴板和系统分享通常需要 HTTPS 或 localhost；Web Crypto 与 Canvas 为必需浏览器能力。

空格标记 `·` 单独使用本地嵌入的 TokenChimDot WOFF2 子集（源自 Liberation Mono，SIL OFL 1.1），不依赖系统中文字体。仅包含 U+00B7，页面与 PNG 均使用此字体。许可证见 `public/fonts/TokenChimDot-LICENSE.txt`。如需再生成，安装 Python `fonttools[woff]`，执行 `python3 scripts/subset-dot.py /path/to/LiberationMono-Regular.ttf`。

分享入口位于召唤按钮右侧，召唤按钮始终居中。桌面打开分享 popover，移动端打开底部抽屉；点击打开时自动尝试复制链接，复制失败可在面板内手动选择。面板另提供「复制结果文本」（品牌、按抽取顺序的可见词元/ID/等级及链接）、「保存图片（PNG）」与系统分享。结果变化时关闭面板，避免分享旧结果。

分享按钮使用 Lucide React SVG 图标。复制成功直接在对应按钮显示勾选图标、「链接已复制」或「文本已复制」和绿色状态；失败仅在面板内显示必要提示，保留手动复制入口。
