import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Dataset } from "./core";
import { colors } from "./export";
import "./style.css";
type Metadata = Pick<Dataset, "counts" | "frequencies" | "sha256">;
function RulesPage() {
  const [data, setData] = useState<Metadata | null>(null);
  const [error, setError] = useState(false);
  async function load() {
    setError(false);
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}data/provenance.json`,
      );
      if (!response.ok) throw Error("加载失败");
      setData(await response.json());
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <header>
        <a className="brand" href={import.meta.env.BASE_URL}>
          ✦ TokenChim<span className="brand-cn">词元抽签所</span>
        </a>
        <a className="nav-link" href={import.meta.env.BASE_URL}>
          返回抽卡 ↗
        </a>
      </header>
      <main className="rules-page">
        {error && (
          <div className="error" role="alert">
            规则数据加载失败。<button onClick={load}>重新加载</button>
          </div>
        )}
        <section className="rarity-strip" aria-label="等级图例">
          <span>
            每一种相遇
            <br />
            <strong>都有独特的光芒</strong>
          </span>
          {(["N", "R", "SR", "SSR", "UR"] as const).map((g, i) => (
            <div
              key={g}
              style={{ "--accent": colors[g] } as React.CSSProperties}
            >
              <b>{g}</b>
              <span>
                {
                  [
                    "基础词元",
                    "稀有词元",
                    "超稀有词元",
                    "史诗词元",
                    "特殊标记",
                  ][i]
                }
              </span>
            </div>
          ))}
        </section>
        <section className="rules" id="rules">
          <div className="rules-heading">
            <div className="eyebrow">BEHIND THE TOKENS</div>
            <h1>一点随机，一点语言的浪漫。</h1>
            <p>
              Token 是模型理解语言的基本单元。它可能是一个汉字、一个单词，
              <br />
              也可能只是一个尚未完整的字节片段。
            </p>
          </div>
          <div className="info-grid">
            <div>
              <span className="info-number">01 / 数据</span>
              <h3>来自真实的语言宇宙</h3>
              <p>
                使用 DeepSeek-V3.2 官方词表，基础词表与 added tokens 按 ID
                合并。所有数据随应用提供，抽取时不调用推理 API。
              </p>
              <a
                href="https://huggingface.co/deepseek-ai/DeepSeek-V3.2/blob/a7e62ac04ecb2c0a54d736dc46601c5606cf10a6/tokenizer.json"
                target="_blank"
                rel="noreferrer"
              >
                查看固定版本来源 ↗
              </a>
            </div>
            <div>
              <span className="info-number">02 / 概率</span>
              <h3>每个词元，平等登场</h3>
              <p>
                使用 Web Crypto
                与拒绝采样，从完整词表等概率、不放回抽取。每次抽签相互独立；不同次之间可以遇见相同词元。
              </p>
            </div>
            <div>
              <span className="info-number">03 / 评级</span>
              <h3>稀有度是一场游戏</h3>
              <p>
                等级由固定规则决定，不代表 DeepSeek
                官方评价，也不代表真实词频、价值或抽取权重。
              </p>
            </div>
          </div>
          <details className="method">
            <summary>
              查看完整评级算法与实际数量 <span>＋</span>
            </summary>
            <p>
              25 个非占位 added tokens 固定为 UR，793 个占位符固定为 N。其余
              127,997 个普通词元按综合分排序：ID 排序百分位 × 65% ＋
              字节长度经验分布中位百分位 × 35%。ID 百分位为排序序号 /
              (普通词元数 − 1)，长度百分位为（更短词元数 ＋ 同长度词元数 / 2）/
              普通词元数。同分按 ID 升序排列。
            </p>
            <p>
              累计边界向下取整：前 50% 为 N，接着 30% 为 R、15% 为 SR、最后 5%
              为 SSR。
            </p>
            {data && (
              <>
                <div className="counts">
                  {Object.entries(data.counts).map(([g, n]) => (
                    <span key={g}>
                      <b>{g}</b> {n.toLocaleString()}{" "}
                      <small>({((n / 128815) * 100).toFixed(3)}%)</small>
                    </span>
                  ))}
                </div>
                <p>字节长度频率表（完整词表，包含 added tokens）</p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>字节长度</th>
                        <th>词元数量</th>
                        <th>占比</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.frequencies).map(([l, n]) => (
                        <tr key={l}>
                          <td>{l}</td>
                          <td>{n.toLocaleString()}</td>
                          <td>{((n / 128815) * 100).toFixed(4)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="checksum">词表 SHA-256：{data.sha256}</p>
                <a href={`${import.meta.env.BASE_URL}data/provenance.json`}>
                  数据来源与版本记录
                </a>{" "}
                ·{" "}
                <a href={`${import.meta.env.BASE_URL}data/LICENSE`}>
                  MIT 许可证
                </a>
              </>
            )}
          </details>
          <p className="display-note">
            显示约定：<code>·</code> 空格、<code>↵</code> 换行、<code>⇥</code>{" "}
            制表符、<code>␍</code> 回车；控制字符和不完整 UTF-8
            字节显示为较暗的等宽十六进制（如 <code>91 9C</code>
            ）。原始表示与十六进制字节可在卡片详情中查看。
          </p>
        </section>
      </main>
      <footer>
        <a className="brand" href={import.meta.env.BASE_URL}>
          ✦ TokenChim
        </a>
        <span>让偶然，成为灵感。</span>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RulesPage />
  </React.StrictMode>,
);
