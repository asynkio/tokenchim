import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { DrawRecord } from "./contracts";
import { health, createDraw, loadShare, getDraw, interpretDraw } from "./api";
import { SharePanel } from "./SharePanel";
import "./style.css";
import { TokenCard } from "./TokenCard";
import { ReadingPanel } from "./ReadingPanel";
function App() {
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [record, setRecord] = useState<DrawRecord | null>(null),
    [count, setCount] = useState(3),
    [busy, setBusy] = useState(false),
    [turn, setTurn] = useState(0),
    [readingRequest, setReadingRequest] = useState(false),
    [readingError, setReadingError] = useState("");
  const cards = record?.tokens ?? [];
  const sequence = useRef(0),
    lock = useRef(false),
    controller = useRef<AbortController | null>(null);
  async function load() {
    setError("");
    try {
      const status = await health();
      setReady(status.ready);
    } catch {
      setError("签单服务暂时无法连接，请重试。");
    }
  }
  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    async function restore() {
      const n = ++sequence.current;
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      setReadingRequest(false);
      setReadingError("");
      setNotice("");
      if (!location.hash) {
        setRecord(null);
        setBusy(false);
        lock.current = false;
        return;
      }
      setBusy(true);
      lock.current = true;
      try {
        const next = await loadShare(location.hash, abort.signal);
        if (n !== sequence.current) return;
        setRecord(next);
        setCount(next.tokens.length);
        setTurn((t) => t + 1);
        history.replaceState(
          null,
          "",
          location.pathname + location.search + "#draw=" + next.id,
        );
      } catch (e) {
        if (n === sequence.current && !abort.signal.aborted) {
          setRecord(null);
          setNotice((e as Error).message);
        }
      } finally {
        if (n === sequence.current) {
          setBusy(false);
          lock.current = false;
        }
      }
    }
    void restore();
    addEventListener("hashchange", restore);
    return () => {
      removeEventListener("hashchange", restore);
      sequence.current++;
      controller.current?.abort();
    };
  }, [ready]);
  useEffect(() => {
    if (record?.readingStatus !== "pending" || readingRequest || busy) return;
    const id = record.id,
      n = sequence.current;
    const timer = setTimeout(() => {
      void getDraw(id)
        .then((next) => {
          if (n === sequence.current) setRecord(next);
        })
        .catch(() => {
          if (n === sequence.current)
            setRecord((current) =>
              current?.id === id
                ? {
                    ...current,
                    readingStatus: "failed",
                    readingError: "读取释读状态失败，请重试",
                  }
                : current,
            );
        });
    }, 1000);
    return () => clearTimeout(timer);
  }, [record, readingRequest, busy]);
  async function summon() {
    if (!ready || lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    setReadingRequest(false);
    setReadingError("");
    const n = ++sequence.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    try {
      const next = await createDraw(count, abort.signal);
      if (n !== sequence.current) return;
      setRecord(next);
      setTurn((t) => t + 1);
      history.replaceState(
        null,
        "",
        location.pathname + location.search + "#draw=" + next.id,
      );
    } catch (e) {
      if (n === sequence.current && !abort.signal.aborted)
        setNotice((e as Error).message);
    } finally {
      if (n === sequence.current) {
        setBusy(false);
        lock.current = false;
      }
    }
  }
  async function interpret() {
    if (!record || readingRequest || busy) return;
    const n = sequence.current,
      id = record.id;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setReadingRequest(true);
    setReadingError("");
    try {
      const next = await interpretDraw(id, abort.signal);
      if (n === sequence.current) setRecord(next);
    } catch (e) {
      if (n === sequence.current && !abort.signal.aborted)
        setReadingError((e as Error).message);
    } finally {
      if (n === sequence.current) setReadingRequest(false);
    }
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
                {Array.from({ length: 4 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1} 个词元
                  </option>
                ))}
              </select>
            </label>
            <button
              className="summon"
              disabled={!ready || busy}
              onClick={summon}
            >
              <span>✦</span>{" "}
              {!ready
                ? "连接签单服务…"
                : busy
                  ? "正在召唤…"
                  : cards.length
                    ? "再抽一次"
                    : "开启我的词元奇遇"}{" "}
              <span>→</span>
            </button>
            <div className="share-slot">
              {record && <SharePanel record={record} disabled={busy} />}
            </div>
          </div>
          {record && !busy && (
            <ReadingPanel
              record={record}
              busy={readingRequest || record.readingStatus === "pending"}
              error={readingError}
              onInterpret={interpret}
            />
          )}
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
