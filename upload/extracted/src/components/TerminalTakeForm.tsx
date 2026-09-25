"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getTerminalClockAction,
  submitTerminalAssessmentAction,
} from "@/db/actions";
import { useI18n } from "@/lib/i18n";
import type { AnswerValue } from "@/lib/scoring";

type Question = {
  id: number;
  prompt: string;
  type?: "single" | "multiple" | "text";
  options: string[];
};

type Clock = {
  serverNow: number;
  startedAt: string;
  expiresAt: string;
  warnAt: number;
};

export function TerminalTakeForm({
  slotNumber,
  queueItemId,
  assignmentId,
  title,
  personName,
  roleTitle,
  questions,
  clock,
}: {
  slotNumber: number;
  queueItemId: number;
  assignmentId: number;
  title: string;
  personName: string;
  roleTitle: string;
  questions: Question[];
  clock: Clock;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showWarn, setShowWarn] = useState(false);
  const [finished, setFinished] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((new Date(clock.expiresAt).getTime() - clock.serverNow) / 1000)),
  );
  const submittedRef = useRef(false);
  const changesRef = useRef(0);
  const exitsRef = useRef(0);
  const offsetRef = useRef(0);

  const expiresAtMs = new Date(clock.expiresAt).getTime();
  const warnAtMs = clock.warnAt;

  const submit = useCallback(
    (timedOut = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      startTransition(async () => {
        try {
          await submitTerminalAssessmentAction(
            slotNumber,
            queueItemId,
            assignmentId,
            answers,
            {
              timedOut,
              answerChanges: changesRef.current,
              pageExits: exitsRef.current,
              userAgent: navigator.userAgent,
            },
          );
          setFinished(true);
          setTimeout(() => router.push(`/terminal/${slotNumber}`), 2500);
          router.refresh();
        } catch {
          submittedRef.current = false;
          setError(t("save_fail"));
        }
      });
    },
    [
      slotNumber,
      queueItemId,
      assignmentId,
      answers,
      router,
      t,
    ],
  );

  useEffect(() => {
    offsetRef.current = Date.now() - clock.serverNow;
    const tick = () => {
      const now = Date.now() - offsetRef.current;
      setSecondsLeft(Math.max(0, Math.ceil((expiresAtMs - now) / 1000)));
      if (now >= warnAtMs && !showWarn && !submittedRef.current) {
        setShowWarn(true);
      }
      if (now >= expiresAtMs && !submittedRef.current) {
        submit(true);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clock.serverNow, expiresAtMs, warnAtMs, showWarn, submit]);

  useEffect(() => {
    const sync = setInterval(async () => {
      const data = await getTerminalClockAction(queueItemId);
      if (data?.expired && !submittedRef.current) {
        submit(true);
      }
    }, 60_000);
    return () => clearInterval(sync);
  }, [queueItemId, submit]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && !submittedRef.current) {
        exitsRef.current += 1;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  function setAnswer(questionId: number, value: AnswerValue) {
    const key = String(questionId);
    setAnswers((previous) => {
      if (previous[key] !== undefined) changesRef.current += 1;
      return { ...previous, [key]: value };
    });
  }

  function toggleMultiple(qId: number, optIdx: number) {
    const key = String(qId);
    const cur = Array.isArray(answers[key]) ? [...(answers[key] as number[])] : [];
    const pos = cur.indexOf(optIdx);
    if (pos >= 0) cur.splice(pos, 1);
    else cur.push(optIdx);
    setAnswer(qId, cur);
  }

  function onManualSubmit() {
    submit(false);
  }

  if (finished) {
    return (
      <section className="terminal-card">
        <h1>{t("terminal_done_title")}</h1>
        <p className="muted">{t("terminal_done_note")}</p>
      </section>
    );
  }

  const currentQuestion = questions[questionIndex];
  const answeredCount = questions.filter((question) => {
    const value = answers[String(question.id)];
    return typeof value === "number" ||
      (Array.isArray(value) && value.length > 0) ||
      (typeof value === "string" && value.trim().length > 0);
  }).length;

  return (
    <>
      {showWarn ? (
        <div className="terminal-warn-overlay" role="alertdialog">
          <div className="terminal-warn-modal">
            <h2>{t("terminal_warn_title")}</h2>
            <p>{t("terminal_warn_note")}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowWarn(false)}
            >
              {t("terminal_warn_ok")}
            </button>
          </div>
        </div>
      ) : null}

      <section className="terminal-card terminal-card-wide">
        <p className="eyebrow">{roleTitle}</p>
        <h1>{title}</h1>
        <p className="muted">
          {t("candidate_label")}: {personName}
        </p>

        <div className="entrance-test-status">
          <strong>
            {t("question_n").replace("{n}", String(questionIndex + 1))} /{" "}
            {questions.length}
          </strong>
          <span>
            {answeredCount}/{questions.length}
          </span>
          <span className={secondsLeft <= 300 ? "entrance-test-timer is-warning" : "entrance-test-timer"}>
            {Math.floor(secondsLeft / 60)}:
            {String(secondsLeft % 60).padStart(2, "0")}
          </span>
        </div>
        <div className="entrance-test-progress" aria-hidden>
          <span
            style={{
              width: `${questions.length ? ((questionIndex + 1) / questions.length) * 100 : 0}%`,
            }}
          />
        </div>

        <div className="question-list">
          {currentQuestion ? [currentQuestion].map((q) => {
            const type = q.type || "single";
            const key = String(q.id);
            return (
              <fieldset key={q.id} className="question">
                <legend>
                  {questionIndex + 1}. {q.prompt}
                </legend>
                {type === "text" ? (
                  <textarea
                    rows={4}
                    value={
                      typeof answers[key] === "string"
                        ? (answers[key] as string)
                        : ""
                    }
                    onChange={(e) =>
                            setAnswer(q.id, e.target.value)
                    }
                  />
                ) : (
                  <div className="options">
                    {q.options.map((opt, optIdx) => {
                      const selected =
                        type === "multiple"
                          ? Array.isArray(answers[key]) &&
                            (answers[key] as number[]).includes(optIdx)
                          : answers[key] === optIdx;
                      return (
                        <label
                          key={optIdx}
                          className={selected ? "option selected" : "option"}
                        >
                          <input
                            type={type === "multiple" ? "checkbox" : "radio"}
                            name={`q-${q.id}`}
                            checked={selected}
                            onChange={() => {
                              if (type === "multiple") {
                                toggleMultiple(q.id, optIdx);
                              } else {
                              setAnswer(q.id, optIdx);
                              }
                            }}
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            );
          }) : null}
        </div>

        {error ? <p className="error">{error}</p> : null}

        <div className="actions-row entrance-test-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending || questionIndex === 0}
            onClick={() => setQuestionIndex((value) => Math.max(0, value - 1))}
          >
            ←
          </button>
          {questionIndex < questions.length - 1 ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                setQuestionIndex((value) =>
                  Math.min(questions.length - 1, value + 1),
                )
              }
            >
              {locale === "uz" ? "Keyingi" : locale === "en" ? "Next" : "Далее"} →
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={onManualSubmit}
            >
              {pending ? t("saving") : t("finish")}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
