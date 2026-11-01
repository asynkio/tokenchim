# TokenChim · 词元抽签所

中文响应式 React + TypeScript + Vite 抽卡应用，搭配 Node 后端和 SQLite。默认抽取 3 个不同 ID 的 token，可选 1–10 个；用户主动点击「释读此签」后才调用 DeepSeek，生成整组释读及各 3 条「宜」「忌」。无需账号。

## 本地运行

需要 **Node.js 24+**（使用内置 SQLite）。

```sh
npm ci
cp .env.example .env.local
# 编辑 .env.local，填入 DEEPSEEK_API_KEY；密钥只在后端使用。
npm run dev
```

开发页面默认在 `http://localhost:5173`，后端默认在 `http://127.0.0.1:3001`。Vite 自动代理 API；一个命令启动两者。没有 API key 也可以抽签、保存签单、分享和导出，点击释读会提示尚未配置。项目包含完整离线词表，运行无需访问 Hugging Face。

```sh
npm test         # 7 项核心测试 + 后端接口/持久化/模型模拟测试
npm run build   # 前后端 TypeScript 检查 + Vite 生产构建
npm start       # Node 托管 dist/ 和 /api，默认端口 3001
```

`npm run preview` 只预览前端静态资源，不包含 API；完整生产验证请使用 `npm start`。

浏览器测试：先执行 `npx playwright install chromium`，再运行 `npm run test:browser`。测试启动隔离的前后端（5174 / 3002）与临时 SQLite 库，明确使用空 API key，DeepSeek 响应全部模拟，不消耗真实额度。

本次交付不包含线上部署。签单分享需要接收者能访问同一个后端；localhost 链接只适合本机。`DATABASE_PATH` 默认 `var/tokenchim.sqlite`，成功签单和释读无自动过期，重启后仍存在；备份前先停止服务，复制整个数据库目录即可。数据库文件与 `.env.local` 已被 Git 忽略。

| 环境变量           | 默认值 / 用途                                               |
| ------------------ | ----------------------------------------------------------- |
| `DEEPSEEK_API_KEY` | 空；仅后端读取，禁止添加 `VITE_` 前缀                       |
| `DEEPSEEK_MODEL`   | `deepseek-flash`                                            |
| `DATABASE_PATH`    | `var/tokenchim.sqlite`                                      |
| `HOST` / `PORT`    | `127.0.0.1` / `3001`                                        |
| `VITE_PORT`        | `5173`，开发前端端口                                        |
| `BASE_PATH`        | `/`；子路径需同时用于前端构建与后端运行，例如 `/tokenchim/` |

## 签单与释读

后端使用现有 Web Crypto 拒绝采样算法抽签，等级仍由离线固定规则决定。DeepSeek 不参与随机抽样和评级。每次抽签持久保存 UUID、官方卡片快照、版本与有序 IDs。

新分享链接为 `#draw=<uuid>`，接收者读取同一签单，不自动生成释读。旧版 `#v=…&r=…&ids=…` 链接仍可打开，服务端验证版本、数量、重复与不存在的 ID，并将同一旧链接映射到固定签单。

释读采用诗意但易懂的现代中文，不提供问题输入框。成功内容只生成一次并保存模型、提示词版本和时间；重复或并发点击同一签单复用同一次调用。服务重启后遗留的生成中状态会变为可重试失败状态。客户端换签或关闭页面不会丢弃后端已开始生成的结果。

模型接口使用 `https://api.deepseek.com/chat/completions`，非流式、关闭思考、JSON 输出，最多 1,024 输出 tokens、30 秒超时。后端校验标题、释读和宜忌数组，空响应、截断或结构错误不会当作成功结果；不自动重试付费调用。提示词将词元当作数据，输出在页面及导出中仅作纯文本处理。模型输入独立于卡面展示：从保存的原始字节严格 UTF-8 解码，保留前后空格、换行、制表符、BOM 和其他控制字符；每个字面文本片段作为独立 text 内容块发送，不再把原文额外 JSON 字符串化。API 请求外层正常的 JSON 传输转义不改变解码后的原字符。无法独立解码的字节不能作为 Unicode 文本传送，因此只作明确的字节说明，不替换为 `�` 或假装是十六进制字面词语。词表内部的 `Ġ` 等 ByteLevel 表示也不当作原文。提示词版本为 `reading-v3`：以词义和意象为主，正常词元不附 ID、等级、HEX 等技术元信息，也不反复强调空白规则；仅不可独立解码的片段附必要字节说明。已保存的旧释读仍保持原样。

本项目继续固定使用 V3.2 词表，与释读 API 的当前分词器不必一致。官方已公开 [DeepSeek-V4.1-Flash/tokenizer.json](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/tokenizer.json)，但 [API 更新记录](https://api-docs.deepseek.com/updates/) 标明 `deepseek-flash` 已更新至 V4.1-Flash-1017，不能仅凭该文件断言线上分词器完全一致。发送时明确来源词表，API 会对收到的原文按其自身分词器重新编码。

新释读默认每 IP 每分钟 6 次、全局同时 2 次；成功结果和同签单的在途请求不重复计费。没有账号、保底或重新生成成功释读的功能。宜忌只是趣味灵感。

| API                                                         | 行为                                     |
| ----------------------------------------------------------- | ---------------------------------------- |
| `GET /api/health`                                           | 服务就绪及是否已配置释读能力，不返回密钥 |
| `POST /api/draws`，`{ "count": 3 }`                         | 创建随机签单，不调用模型                 |
| `GET /api/draws/:id`                                        | 读取签单和保存的释读                     |
| `POST /api/draws/:id/interpret`                             | 手动生成释读或返回已保存结果             |
| `POST /api/draws/import`，`{ version, ratingVersion, ids }` | 校验并导入旧版分享链接                   |

接口错误统一为 `{ "error": { "code": "…", "message": "…" } }`；限流响应包含 `Retry-After`。服务器默认仅监听本机，采用单进程 SQLite；API 仅供同源前端调用，不接受客户端传入模型提示词或卡片内容。

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

URL fragment 默认存储签单 UUID，旧版词元链接仍检查版本、1–10 个数量、重复和 ID 存在性。复制失败时提供可选中输入框；系统分享不支持或失败时提供手动链接和 PNG 下载；取消系统分享不会提示错误。

PNG 使用 Canvas，本地生成，使用卡片相同的文本、逐字符换行、按文本长度增加画布高度，并包含品牌、ID、等级、字节数和类型。已生成释读时，PNG 与复制结果文本都会追加同一份释读和宜忌。页面遵循系统减少动态效果设置，支持键盘聚焦、Enter/空格翻面及 Escape 返回正面。

外部字体为可选增强，网络不可用时回退到系统字体。浏览器剪贴板和系统分享通常需要 HTTPS 或 localhost；Web Crypto 与 Canvas 为必需浏览器能力。

空格标记 `·` 单独使用本地嵌入的 TokenChimDot WOFF2 子集（源自 Liberation Mono，SIL OFL 1.1），不依赖系统中文字体。仅包含 U+00B7，页面与 PNG 均使用此字体。许可证见 `public/fonts/TokenChimDot-LICENSE.txt`。如需再生成，安装 Python `fonttools[woff]`，执行 `python3 scripts/subset-dot.py /path/to/LiberationMono-Regular.ttf`。

分享入口位于召唤按钮右侧，召唤按钮始终居中。桌面打开分享 popover，移动端打开底部抽屉；点击打开时自动尝试复制链接，复制失败可在面板内手动选择。面板另提供「复制结果文本」（品牌、按抽取顺序的可见词元/ID/等级及链接）、「保存图片（PNG）」与系统分享。签单或释读变化时关闭面板，避免分享旧结果。

分享按钮使用 Lucide React SVG 图标。复制成功直接在对应按钮显示勾选图标、「链接已复制」或「文本已复制」和绿色状态；失败仅在面板内显示必要提示，保留手动复制入口。
