import React, { useEffect, useState } from "react";
import { tokenParts, type Token } from "./core";
import { colors } from "./export";

export function TokenCard({
  token: t,
  index,
}: {
  token: Token;
  index: number;
}) {
  const [flipped, setFlipped] = useState(false);
  const [turning, setTurning] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      if (media.matches) setTurning(false);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  function toggle() {
    if (turning) return;
    setTurning(!matchMedia("(prefers-reduced-motion: reduce)").matches);
    setFlipped((value) => !value);
  }
  const detailsId = `token-details-${t.id}`;
  return (
    <article
      className={`card revealed${flipped ? " is-flipped" : ""}${turning ? " is-turning" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`词元 #${t.id}，${flipped ? "点击返回词元" : "点击翻面查看详情"}`}
      aria-pressed={flipped}
      aria-describedby={flipped ? `${detailsId} flip-hint` : "flip-hint"}
      onClick={() => {
        if (!window.getSelection()?.toString()) toggle();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setTurning(false);
          setFlipped(false);
        } else if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          toggle();
        }
      }}
      style={
        {
          "--accent": colors[t.grade],
          "--delay": `${index * 90}ms`,
        } as React.CSSProperties
      }
    >
      <div
        className="card-flipper"
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) setTurning(false);
        }}
      >
        <div
          className="card-face card-front"
          aria-hidden={flipped}
          inert={flipped}
        >
          <div className="card-top">
            <span className="grade">{t.grade}</span>
            <span className="card-serial">
              TOKEN / {String(index + 1).padStart(2, "0")}
            </span>
          </div>
          <div className="token-text">
            <span>
              {tokenParts(t).map((part, i) =>
                part.kind === "text" ? (
                  <React.Fragment key={i}>{part.text}</React.Fragment>
                ) : (
                  <code key={i}>{part.text}</code>
                ),
              )}
            </span>
          </div>
          <div className="card-bottom">
            <div className="token-id">#{t.id}</div>
            <div className="token-meta">
              <span>{t.length} BYTES</span>
            </div>
          </div>
        </div>
        <div
          className="card-face card-back"
          aria-hidden={!flipped}
          inert={!flipped}
        >
          <div className="card-top">
            <span className="details-title">字节详情</span>
            <span className="card-serial">#{t.id}</span>
          </div>
          <dl
            id={detailsId}
            className="byte-details"
            tabIndex={flipped ? 0 : -1}
          >
            <dt>原始表示</dt>
            <dd>{t.raw}</dd>
            <dt>原始字节 / HEX</dt>
            <dd>
              <code>{t.hex.toUpperCase()}</code>
            </dd>
            <dt>官方 special</dt>
            <dd>{String(t.special)}</dd>
          </dl>
        </div>
      </div>
    </article>
  );
}
