"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatProductAnswers, type ProductAnswer, type ProductAnswers, type ProductQuestions } from "@/lib/product-planning/questions";

export function ProductQuestionCard({ questions, messageId, active, disabled, onSubmit }: {
  questions: ProductQuestions; messageId: string; active: boolean; disabled?: boolean;
  onSubmit: (input: { prompt: string; productAnswers: ProductAnswers; clientTurnId: string }) => Promise<boolean>;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<ProductAnswer[]>([]);
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const submitting = useRef(false);
  const turnId = useRef<string | null>(null);
  const question = questions[index];
  const locked = disabled || busy;

  const submit = useCallback(async (next: ProductAnswer[]) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(false);
    turnId.current ??= crypto.randomUUID();
    try {
      const ok = await onSubmit({
        prompt: formatProductAnswers(questions, next).content,
        productAnswers: { messageId, answers: next },
        clientTurnId: turnId.current,
      });
      if (ok) setSent(true);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }, [messageId, onSubmit, questions]);

  const choose = useCallback((answer: ProductAnswer) => {
    if (locked || submitting.current) return;
    const next = [...answers.slice(0, index), answer];
    setAnswers(next);
    setCustom(false);
    setText("");
    if (index + 1 < questions.length) setIndex(index + 1);
    else void submit(next);
  }, [answers, index, locked, questions.length, submit]);

  useEffect(() => {
    if (!active || locked || error) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isInputFocused) {
        if (e.key === "Escape" && custom) {
          setCustom(false);
          setText("");
        }
        return;
      }

      if (e.key === "1") {
        e.preventDefault();
        choose({ kind: "choice", index: 0 });
      } else if (e.key === "2" && question.choices.length > 1) {
        e.preventDefault();
        choose({ kind: "choice", index: 1 });
      } else if (e.key === "3" && question.choices.length > 2) {
        e.preventDefault();
        choose({ kind: "choice", index: 2 });
      } else if (e.key === "4") {
        e.preventDefault();
        setCustom(true);
      } else if (e.key === "Escape" && custom) {
        e.preventDefault();
        setCustom(false);
        setText("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, locked, error, custom, question, choose]);

  if ((!active && !error && !busy) || sent) return (
    <details className="mx-4 mb-4 rounded-xl border border-slate-950/10 bg-slate-50/50 p-3 text-xs text-slate-500">
      <summary className="cursor-pointer font-medium hover:text-slate-700">
        Screen choices · {questions.length} {questions.length === 1 ? "question" : "questions"}
      </summary>
      <div className="mt-2 space-y-1.5 border-t border-slate-950/10 pt-2">
        {questions.map(item => <p key={item.question} className="leading-relaxed">{item.question}</p>)}
        <p className="text-[11px] text-slate-400">Continue in chat to change a decision.</p>
      </div>
    </details>
  );

  return (
    <section aria-label="Screen design questions" aria-busy={busy} className="mx-4 mb-4 rounded-2xl border border-slate-950/10 bg-white p-4 text-sm text-slate-950 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500">
        <span>Shape your screens · Optional</span>
        <span className="font-mono text-xs">{index + 1} / {questions.length}</span>
      </div>
      <div aria-live="polite" aria-atomic="true">
        <h3 className="text-sm font-semibold leading-5 text-slate-950">{question.question}</h3>
        {question.consequence ? (
          <p className="mt-1 text-xs leading-5 text-slate-500">{question.consequence}</p>
        ) : null}
      </div>

      <div className="mt-3.5 overflow-hidden rounded-xl border border-slate-950/10 bg-white shadow-sm divide-y divide-slate-950/10">
        {question.choices.map((choice, choiceIndex) => (
          <button
            key={`${index}-${choiceIndex}`}
            type="button"
            disabled={locked || error}
            onClick={() => choose({ kind: "choice", index: choiceIndex })}
            className="group flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-slate-950/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs font-semibold text-slate-900">{choice.label}</span>
                {choiceIndex === 0 && (
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                    Recommended
                  </span>
                )}
              </div>
              <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">{choice.description}</span>
            </div>
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-slate-950/10 dark:border-white/15 bg-slate-950/5 dark:bg-white/10 text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 group-hover:border-slate-950/20 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
              {choiceIndex + 1}
            </span>
          </button>
        ))}

        {!custom ? (
          <button
            type="button"
            disabled={locked || error}
            aria-expanded={custom}
            onClick={() => setCustom(true)}
            className="group flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-xs transition-colors hover:bg-slate-950/5 dark:hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50"
          >
            <span className="font-medium text-slate-600 dark:text-slate-300">Write my own answer…</span>
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-slate-950/10 dark:border-white/15 bg-slate-950/5 dark:bg-white/10 text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 group-hover:border-slate-950/20 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
              4
            </span>
          </button>
        ) : (
          <div className="bg-slate-50/50 p-3">
            <form
              onSubmit={event => {
                event.preventDefault();
                if (text.trim()) choose({ kind: "custom", text: text.trim() });
              }}
            >
              <label className="sr-only" htmlFor={`answer-${messageId}`}>Your answer</label>
              <textarea
                id={`answer-${messageId}`}
                autoFocus
                value={text}
                maxLength={2000}
                disabled={locked}
                rows={3}
                onChange={event => setText(event.target.value)}
                placeholder="Type your own answer or preference..."
                className="w-full resize-y rounded-lg border border-slate-950/15 bg-white p-2.5 text-xs leading-relaxed text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="submit"
                  disabled={locked || !text.trim()}
                  className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  Use my answer
                </button>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setCustom(false);
                    setText("");
                  }}
                  className="rounded-lg px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          disabled={locked || error}
          onClick={() => choose({ kind: "skip" })}
          className="rounded-lg border border-slate-950/15 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-950/5 dark:hover:bg-white/10 shadow-sm transition-colors disabled:opacity-50"
        >
          Skip
        </button>
        {index > 0 && (
          <button
            type="button"
            disabled={locked || error}
            onClick={() => {
              setIndex(index - 1);
              setCustom(false);
              setText("");
            }}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-50 transition-colors"
          >
            ← Back
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
        Skip lets Drawgle suggest a direction. You can change it later.
      </p>

      {busy && <p role="status" className="mt-2 text-xs text-slate-500">Saving your choices…</p>}
      {error && (
        <div role="alert" className="mt-2 text-xs text-rose-600">
          Your choices are still here. Couldn’t finish this turn.
          <button type="button" disabled={locked} className="ml-1 underline font-medium" onClick={() => void submit(answers)}>
            Retry
          </button>
        </div>
      )}
    </section>
  );
}
