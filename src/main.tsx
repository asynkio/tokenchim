import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  draw,
  decodeShare,
  VOCAB_VERSION,
  RATING_VERSION,
  type Dataset,
  type Token,
} from "./core";
import { SharePanel } from "./SharePanel";
import "./style.css";
import { TokenCard } from "./TokenCard";
function App() {
  const [data, setData] = useState<Dataset | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [cards, setCards] = useState<Token[]>([]),
    [count, setCount] = useState(3),
    [busy, setBusy] = useState(false),
    [turn, setTurn] = useState(0);
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function load() {
    setError("");
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}data/tokens.json`);
      if (!r.ok) throw Error("词表加载失败");
      const d: Dataset = await r.json();
      if (
        d.version !== VOCAB_VERSION ||
        d.rating !== RATING_VERSION ||
        d.tokens.length !== 128815
      )
        throw Error("词表版本或数量异常");
      setData(d);
    } catch {
      setError("词表暂时无法加载，请检查网络后重试。");
    }
  }
  useEffect(() => {
    void load();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (!data) return;
    function restore() {
      if (!location.hash) return;
      try {
        const result = decodeShare(location.hash, data!.tokens);
        setCards(result);
        setCount(result.length);
      } catch (e) {
        setNotice((e as Error).message);
      }
    }
    restore();
    addEventListener("hashchange", restore);
    return () => removeEventListener("hashchange", restore);
  }, [data]);
  function summon() {
    if (!data || lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    timer.current = setTimeout(() => {
      try {
        setCards(draw(data.tokens, count));
        setTurn((t) => t + 1);
        history.replaceState(null, "", location.pathname + location.search);
      } catch (e) {
        setNotice((e as Error).message);
      } finally {
        lock.current = false;
        setBusy(false);
      }
    }, 450);
  }
  return (
    <>
      <header>
        <a className="brand" href={location.pathname}>
          <span className="brand-mark">
            T<span>✦</span>
          </span>
          TokenChim<span className="brand-cn">词元抽签所</span>
        </a>
        <a className="nav-link" href={`${import.meta.env.BASE_URL}rules.html`}>
          游戏规则 <span>↗</span>
        </a>
      </header>
      <main>
        <section className="hero">
          <div className="eyebrow">
            <i /> DEEPSEEK V3.2 · TOKEN GACHA
          </div>
          <h1>
            你的下一次奇遇，
            <br />
            藏在一个<span className="gradient"> Token </span>里。
          </h1>
          <p className="intro">
            128,815 个词元，等待与你相遇。
            <br className="mobile-break" /> 抽一签，看看语言宇宙给你的回应。
          </p>
        </section>
        <section className="machine" aria-label="词元抽卡">
          <div className="section-bar">
            <span>
              <i className="tiny-cross">✦</i> 词元召唤阵{" "}
              <small>SUMMON YOUR TOKENS</small>
            </span>
          </div>
          <div
            className={`cards ${busy ? "shuffling" : ""}`}
            key={turn}
            aria-busy={busy}
          >
            {cards.length
              ? cards.map((t, i) => (
                  <TokenCard token={t} index={i} key={t.id} />
                ))
              : Array.from({ length: 3 }, (_, i) => (
                  <div className="card sealed" key={i}>
                    <div className="back-corner">TC / 0{i + 1}</div>
                    <div className="sigil">
                      <span>✧</span>
                    </div>
                    <div className="sealed-label">
                      未知的可能性<small>AWAITING YOUR SIGNAL</small>
                    </div>
                    <span className="back-bottom">TOKENCHIM · 词元抽签所</span>
                  </div>
                ))}
          </div>
          {cards.length > 0 && (
            <p className="flip-hint" id="flip-hint">
              <span aria-hidden="true">↻</span>{" "}
              点击卡片翻面查看详情，再次点击返回
            </p>
          )}
          <div className="controls">
            <label>
              每次抽取{" "}
              <select
                value={count}
                disabled={busy}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1} 个词元
                  </option>
                ))}
              </select>
            </label>
            <button
              className="summon"
              disabled={!data || busy}
              onClick={summon}
            >
              <span>✦</span>{" "}
              {!data
                ? "加载词表…"
                : busy
                  ? "正在召唤…"
                  : cards.length
                    ? "再抽一次"
                    : "开启我的词元奇遇"}{" "}
              <span>→</span>
            </button>
            <div className="share-slot">
              {cards.length > 0 && (
                <SharePanel tokens={cards} disabled={busy} />
              )}
            </div>
          </div>
          {error && (
            <div className="error" role="alert">
              {error} <button onClick={load}>重新加载</button>
            </div>
          )}
          {notice && (
            <div className="notice" role="alert">
              {notice}
            </div>
          )}
        </section>
      </main>
      <footer>
        <a className="brand" href={location.pathname}>
          ✦ TokenChim
        </a>
        <span>让偶然，成为灵感。</span>
        <small>BUILT FOR THE CURIOSITY OF LANGUAGE</small>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
