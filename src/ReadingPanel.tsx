import { Sparkles, LoaderCircle, RefreshCw, Check, Minus } from "lucide-react";
import type { DrawRecord } from "./contracts";
export function ReadingPanel({
  record,
  busy,
  error,
  onInterpret,
}: {
  record: DrawRecord;
  busy: boolean;
  error: string;
  onInterpret: () => void;
}) {
  const reading = record.reading;
  if (reading && record.readingStatus === "ready")
    return (
      <section className="reading-section" aria-label="词元释读">
        <div className="reading-eyebrow">
          <Sparkles size={14} aria-hidden="true" /> 词元释读
        </div>
        <h2>{reading.title}</h2>
        <p className="reading-prose">{reading.interpretation}</p>
        <div className="reading-advice">
          <div className="reading-dos">
            <h3>
              <Check size={17} aria-hidden="true" /> 宜
            </h3>
            <ul>
              {reading.dos.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          </div>
          <div className="reading-donts">
            <h3>
              <Minus size={17} aria-hidden="true" /> 忌
            </h3>
            <ul>
              {reading.donts.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="reading-footnote">AI 释读 · 趣味灵感</p>
      </section>
    );
  const failure = busy ? "" : error || record.readingError;
  return (
    <section className="interpret-control" aria-label="词元释读">
      <button
        onClick={onInterpret}
        disabled={busy}
        className="interpret-button"
      >
        {busy ? (
          <LoaderCircle
            className="share-spinner"
            size={16}
            aria-hidden="true"
          />
        ) : failure ? (
          <RefreshCw size={16} aria-hidden="true" />
        ) : (
          <Sparkles size={16} aria-hidden="true" />
        )}
        {busy ? "正在释读…" : failure ? "重试释读" : "释读此签"}
      </button>
      {failure && (
        <p role="alert" className="reading-error">
          {failure}
        </p>
      )}
    </section>
  );
}
