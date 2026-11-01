# TokenChim · 词元抽签所

从 DeepSeek 官方词表中抽取词元，获得一组属于你的签。默认抽取 3 张，可选 1–4 张；点按卡片翻面查看详情，支持分享链接、复制结果和保存图片。

点击「释读此签」可生成整组释读及「宜」「忌」。释读仅供娱乐和灵感参考，成功结果会保存，分享链接可查看同一份结果。未配置 DeepSeek API key 时，仍可抽签和分享。

页面默认跟随系统的浅色／深色模式，可通过页头按钮切换；手动选择会保存在当前浏览器，首页与规则页共用，导出图片也采用当前主题。

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

| 环境变量                        | 默认值 / 用途                                           |
| ------------------------------- | ------------------------------------------------------- |
| `DEEPSEEK_API_KEY`              | 可选，启用释读；调用会产生 API 费用                     |
| `DEEPSEEK_MODEL`                | `deepseek-flash`                                        |
| `DATABASE_PATH`                 | `var/tokenchim.sqlite`，签单和释读的保存位置            |
| `HOST` / `PORT`                 | `127.0.0.1` / `3001`                                    |
| `BASE_PATH`                     | `/`，站点部署路径                                       |
| `VITE_PORT`                     | `5173`，仅开发环境使用                                  |
| `TRUSTED_PROXY_IPS`             | 默认为空；逗号分隔的直接连接代理 IP，不支持 CIDR 或域名 |
| `API_RATE_LIMIT_PER_MINUTE`     | `120`，每 IP 每分钟 API 请求数，健康检查除外            |
| `DRAW_RATE_LIMIT_PER_MINUTE`    | `20`，每 IP 每分钟新建签单数，抽签和首次导入共用        |
| `READING_RATE_LIMIT_PER_MINUTE` | `6`，每 IP 每分钟新释读数                               |
| `READING_CONCURRENCY`           | `2`，全站同时生成的释读数                               |
| `READING_DAILY_LIMIT`           | `500`，全站每日模型调用次数；`0` 暂停新释读             |

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

当前适合单实例部署。将 `DATABASE_PATH` 指向持久磁盘，更新代码时保留数据库。备份前停止服务并复制整个数据库目录。

单层 Nginx 反向代理可在已有 HTTPS `server` 中配置：

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_read_timeout 45s;
    client_max_body_size 8k;
}
```

同时在服务端设置 `TRUSTED_PROXY_IPS=127.0.0.1,::1`，并保持 `HOST=127.0.0.1`。代理必须**覆盖** `X-Forwarded-For`，不要使用追加客户端请求头的配置。默认不信任代理头；只有连接来自配置中的代理、且请求头是单个合法 IP 时，才按该地址限流。未配置或头部无效时，按连接 IP 限流，代理后的访客会共享额度。此配置仅支持单层代理，不适用于前面还有 CDN 的场景。

分钟额度从首次请求起计算 60 秒，重启后重置。新建签单额度不影响读取已有签单或复用已导入链接，但这些请求仍受 API 总请求限制。限流返回 `429` 和 `Retry-After`，页面提示等待时间，不自动重试；健康检查不受频率限制。

每日释读额度按北京时间零点重置，记录在 SQLite 中，重启不会清零。开始新生成前先预占额度，失败、超时或进程中断均不返还；成功结果和同签单在途请求复用不消耗新生成额度。每日额度用尽不影响抽签或查看已保存结果。此限制按调用次数计算，不是精确金额预算。除每日额度可设为 `0` 外，其余额度均须为正整数；修改配置后重启服务。

若部署到子路径，例如 `/tokenchim/`：构建使用 `pnpm build --base=/tokenchim/`，运行时设置 `BASE_PATH=/tokenchim/`。

## 数据与许可证

词表来自 [DeepSeek-V4.1-Flash-1017](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017)，遵循其 MIT 许可证，详见 [词表许可证](vendor/LICENSE)。等级是游戏规则，不代表官方评价或真实词频。

本地嵌入的字体子集遵循 [SIL OFL 1.1](public/fonts/TokenChimDot-LICENSE.txt)。维护、测试及实现细节见 [AGENTS.md](AGENTS.md)。
