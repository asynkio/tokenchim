# TokenChim · 词元抽签所

从 DeepSeek 官方词表中抽取词元，获得一组属于你的签。默认抽取 3 张，可选 1–10 张；点按卡片翻面查看详情，支持分享链接、复制结果和保存图片。

点击「释读此签」可生成整组释读及「宜」「忌」。释读仅供娱乐和灵感参考，成功结果会保存，分享链接可查看同一份结果。未配置 DeepSeek API key 时，仍可抽签和分享。

## 本地运行

需要 **Node.js 24+** 和 **pnpm 12.5.1**。

```sh
pnpm install --frozen-lockfile
pnpm data:prepare
cp .env.example .env.local
# 在 .env.local 中填写 DEEPSEEK_API_KEY（可选）
pnpm dev
```

打开 `http://localhost:5173`。首次准备词表需要访问 Hugging Face；之后复用通过校验的本地文件，应用运行时无需访问 Hugging Face。

## 配置

配置写入 `.env.local`，也可通过服务端环境变量提供。API key 仅在服务端使用，不要提交到 GitHub。

| 环境变量           | 默认值 / 用途                                |
| ------------------ | -------------------------------------------- |
| `DEEPSEEK_API_KEY` | 可选，启用释读；调用会产生 API 费用          |
| `DEEPSEEK_MODEL`   | `deepseek-flash`                             |
| `DATABASE_PATH`    | `var/tokenchim.sqlite`，签单和释读的保存位置 |
| `HOST` / `PORT`    | `127.0.0.1` / `3001`                         |
| `BASE_PATH`        | `/`，站点部署路径                            |
| `VITE_PORT`        | `5173`，仅开发环境使用                       |

## 服务端部署

在服务器安装上述运行环境，获取项目后执行：

```sh
pnpm install --frozen-lockfile
pnpm data:prepare
cp .env.example .env.local
# 按需配置 API key 和数据库路径
pnpm build
pnpm start
```

访问 `http://127.0.0.1:3001`；`/api/health` 可用于检查服务状态。`pnpm start` 同时提供页面和 API，部署时需保留项目源码、生成的 `public/data/` 与依赖，不能只上传 `dist/`。

通过 systemd 等进程管理器保持服务运行，工作目录设为项目根目录。在前方配置 HTTPS 反向代理，将请求转发至 `127.0.0.1:3001`，并保留原始 `Host`。分享链接需要接收者能访问此服务；剪贴板和系统分享通常需要 HTTPS。

当前适合单实例部署；反向代理后的访客共用释读限流额度。将 `DATABASE_PATH` 指向持久磁盘，更新代码时保留数据库。备份前停止服务并复制整个数据库目录。

若部署到子路径，例如 `/tokenchim/`：构建使用 `pnpm build --base=/tokenchim/`，运行时设置 `BASE_PATH=/tokenchim/`。

## 数据与许可证

词表来自 [DeepSeek-V3.2](https://huggingface.co/deepseek-ai/DeepSeek-V3.2)，遵循其 MIT 许可证，详见 [词表许可证](vendor/LICENSE)。等级是游戏规则，不代表官方评价或真实词频。

本地嵌入的字体子集遵循 [SIL OFL 1.1](public/fonts/TokenChimDot-LICENSE.txt)。维护、测试及实现细节见 [AGENTS.md](AGENTS.md)。
