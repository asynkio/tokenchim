import {
  Share2,
  Link,
  ClipboardCopy,
  Download,
  Check,
  X,
  LoaderCircle,
  Ellipsis,
} from "lucide-react";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { encodeShare, type Token } from "./core";
import { formatResultText } from "./share";
import { exportPng, download } from "./export";
interface Snapshot {
  tokens: Token[];
  url: string;
}
export function SharePanel({
  tokens,
  disabled,
}: {
  tokens: Token[];
  disabled: boolean;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [feedback, setFeedback] = useState("");
  const [copiedTarget, setCopiedTarget] = useState<"link" | "text" | null>(
    null,
  );
  const [manualText, setManualText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [position, setPosition] = useState<React.CSSProperties>({});
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const session = useRef(0);
  const operation = useRef(0);
  function close() {
    session.current++;
    operation.current++;
    setSnapshot(null);
  }
  useEffect(() => {
    close();
  }, [tokens]);
  useEffect(() => {
    addEventListener("hashchange", close);
    return () => removeEventListener("hashchange", close);
  }, []);
  useLayoutEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (!snapshot) {
      if (el.open) el.close();
      return;
    }
    if (!el.open) el.showModal();
    primary.current?.focus({ preventScroll: true });
    function place() {
      if (!el || !trigger.current) return;
      if (matchMedia("(max-width: 760px)").matches) {
        setPosition({});
        return;
      }
      const r = trigger.current.getBoundingClientRect();
      const width = Math.min(380, innerWidth - 32);
      const height = el.getBoundingClientRect().height;
      const below = r.bottom + 12;
      setPosition({
        left: Math.max(16, Math.min(r.right - width, innerWidth - width - 16)),
        top: Math.max(16, Math.min(below, innerHeight - height - 16)),
      });
    }
    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      observer.disconnect();
      removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      document.body.style.overflow = oldOverflow;
    };
  }, [snapshot]);
  async function copy(value: string, type: "link" | "text", automatic = false) {
    const currentSession = session.current;
    const currentOperation = ++operation.current;
    setFeedback("");
    setCopiedTarget(null);
    try {
      await navigator.clipboard.writeText(value);
      if (
        currentSession !== session.current ||
        currentOperation !== operation.current
      )
        return;
      setManualText("");
      setCopiedTarget(type);
    } catch {
      if (
        currentSession !== session.current ||
        currentOperation !== operation.current
      )
        return;
      if (type === "text") setManualText(value);
      setFeedback(
        automatic
          ? "自动复制未成功，请点击复制或手动选择链接"
          : type === "text"
            ? "复制未成功，请手动选择下方结果文本"
            : "复制未成功，请手动选择分享链接",
      );
    }
  }
  function open() {
    const url =
      location.href.split("#")[0] + encodeShare(tokens.map((t) => t.id));
    session.current++;
    setManualText("");
    setExporting(false);
    setSnapshot({ tokens: [...tokens], url });
    // Start within the click gesture, never in a mount effect.
    void copy(url, "link", true);
  }
  async function png() {
    if (!snapshot || exporting) return;
    const currentSession = session.current;
    const currentOperation = ++operation.current;
    setExporting(true);
    setFeedback("");
    try {
      const blob = await exportPng(snapshot.tokens);
      if (currentSession === session.current) {
        download(blob);
      }
    } catch {
      if (
        currentSession === session.current &&
        currentOperation === operation.current
      )
        setFeedback("图片生成失败，请重试");
    } finally {
      if (currentSession === session.current) setExporting(false);
    }
  }
  async function systemShare() {
    if (!snapshot) return;
    const currentSession = session.current;
    const currentOperation = ++operation.current;
    setFeedback("");
    try {
      if (!navigator.share) {
        setFeedback("当前浏览器不支持系统分享，可复制链接或保存图片");
        return;
      }
      await navigator.share({
        title: "我的 TokenChim 词元",
        url: snapshot.url,
      });
    } catch (e) {
      if (
        currentSession === session.current &&
        currentOperation === operation.current &&
        (e as Error).name !== "AbortError"
      )
        setFeedback("系统分享不可用，可复制链接或保存图片");
    }
  }
  return (
    <>
      <button
        ref={trigger}
        className="share-trigger"
        disabled={disabled}
        onClick={open}
        aria-label="分享"
        aria-haspopup="dialog"
        aria-expanded={!!snapshot}
        aria-controls="share-panel"
      >
        <Share2 size={18} aria-hidden="true" focusable="false" />
        <span className="share-trigger-label">分享</span>
      </button>
      <dialog
        ref={dialog}
        id="share-panel"
        className="share-panel"
        aria-labelledby="share-title"
        style={position}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const items = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>(
              'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex="0"]',
            ),
          );
          const first = items[0],
            last = items.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClose={() => {
          if (!dialog.current?.open) {
            setSnapshot(null);
            trigger.current?.focus({ preventScroll: true });
          }
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const r = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < r.left ||
              e.clientX > r.right ||
              e.clientY < r.top ||
              e.clientY > r.bottom
            )
              close();
          }
        }}
      >
        {snapshot && (
          <>
            <div className="share-heading">
              <h2 id="share-title">分享抽卡结果</h2>
              <button
                className="share-close"
                aria-label="关闭分享面板"
                onClick={close}
              >
                <X size={20} aria-hidden="true" focusable="false" />
              </button>
            </div>
            <label className="share-field">
              分享链接
              <textarea
                rows={3}
                readOnly
                value={snapshot.url}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <button
              ref={primary}
              className={`share-primary${copiedTarget === "link" ? " is-copied" : ""}`}
              aria-live="polite"
              onClick={() => void copy(snapshot.url, "link")}
            >
              {copiedTarget === "link" ? (
                <Check size={17} aria-hidden="true" focusable="false" />
              ) : (
                <Link size={17} aria-hidden="true" focusable="false" />
              )}
              {copiedTarget === "link" ? "链接已复制" : "复制分享链接"}
            </button>
            {feedback && (
              <div className="share-error" role="alert">
                {feedback}
              </div>
            )}
            <div className="share-secondary">
              <button
                className={copiedTarget === "text" ? "is-copied" : undefined}
                aria-live="polite"
                onClick={() =>
                  void copy(
                    formatResultText(snapshot.tokens, snapshot.url),
                    "text",
                  )
                }
              >
                {copiedTarget === "text" ? (
                  <Check size={16} aria-hidden="true" focusable="false" />
                ) : (
                  <ClipboardCopy
                    size={16}
                    aria-hidden="true"
                    focusable="false"
                  />
                )}
                {copiedTarget === "text" ? "文本已复制" : "复制结果文本"}
              </button>
              <button onClick={png} disabled={exporting}>
                {exporting ? (
                  <LoaderCircle
                    className="share-spinner"
                    size={16}
                    aria-hidden="true"
                    focusable="false"
                  />
                ) : (
                  <Download size={16} aria-hidden="true" focusable="false" />
                )}
                {exporting ? "生成中…" : "保存图片（PNG）"}
              </button>
            </div>
            {manualText && (
              <label className="share-field manual-result">
                手动复制结果文本
                <textarea
                  rows={5}
                  readOnly
                  value={manualText}
                  onFocus={(e) => e.target.select()}
                />
              </label>
            )}
            <button className="share-more" onClick={systemShare}>
              <Ellipsis size={17} aria-hidden="true" focusable="false" />{" "}
              更多分享方式
            </button>
          </>
        )}
      </dialog>
    </>
  );
}
