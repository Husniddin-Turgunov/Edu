"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { submitCandidateAssessmentAction } from "@/db/actions";
import { useI18n } from "@/lib/i18n";
import type { AnswerValue } from "@/lib/scoring";

type Question = {
  id: number;
  prompt: string;
  type?: "single" | "multiple" | "text";
  options: string[];
};

const COPY = {
  ru: {
    question: "Вопрос",
    of: "из",
    remaining: "Осталось",
    answered: "Отвечено",
    back: "Назад",
    next: "Далее",
    finish: "Завершить тест",
    saving: "Отправляем…",
    skipped: "Есть пропущенные вопросы. Завершить тест?",
    done: "Тест завершён",
    doneNote: "Результат сохранён и доступен HR. Правильные ответы и баллы во время теста не показываются.",
    timeout: "Время завершилось. Ответы отправлены автоматически.",
    error: "Не удалось сохранить результат. Попробуйте ещё раз.",
    written: "Введите ответ",
  },
  uz: {
    question: "Savol",
    of: "dan",
    remaining: "Qoldi",
    answered: "Javob berildi",
    back: "Orqaga",
    next: "Keyingi",
    finish: "Testni yakunlash",
    saving: "Yuborilmoqda…",
    skipped: "Javobsiz savollar bor. Test yakunlansinmi?",
    done: "Test yakunlandi",
    doneNote: "Natija saqlandi va HR uchun mavjud. To‘g‘ri javoblar va ballar test vaqtida ko‘rsatilmaydi.",
    timeout: "Vaqt tugadi. Javoblar avtomatik yuborildi.",
    error: "Natijani saqlab bo‘lmadi. Qayta urinib ko‘ring.",
    written: "Javobni kiriting",
  },
  en: {
    question: "Question",
    of: "of",
    remaining: "Remaining",
    answered: "Answered",
    back: "Back",
    next: "Next",
    finish: "Finish test",
    saving: "Submitting…",
    skipped: "Some questions are unanswered. Finish the test?",
    done: "Test completed",
    doneNote: "The result was saved and is available to HR. Correct answers and scores are hidden during the test.",
    timeout: "Time is up. Your answers were submitted automatically.",
    error: "Could not save the result. Please try again.",
    written: "Enter your answer",
  },
} as const;

function hasAnswer(value: AnswerValue | undefined) {
  if (typeof value === "number") return true;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim().length > 0;
}

export function CandidateEntranceTestForm({
  assignmentId,
  questions,
  expiresAt,
  returnTo,
  embedded = false,
  showResult = false,
}: {
  assignmentId: number;
  questions: Question[];
  expiresAt: string;
  returnTo?: string;
  embedded?: boolean;
  showResult?: boolean;
}) {
  const { locale, t } = useI18n();
  const shellClass = embedded ? "" : "panel ";
  const copy = COPY[locale];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );
  const [pending, startTransition] = useTransition();
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState("");
  const changesRef = useRef(0);
  const exitsRef = useRef(0);
  const submittedRef = useRef(false);

  const answeredCount = useMemo(
    () => questions.filter((question) => hasAnswer(answers[String(question.id)])).length,
    [answers, questions],
  );

  const submit = useCallback(
    (timeout = false) => {
      if (submittedRef.current) return;
      if (!timeout && answeredCount < questions.length && !window.confirm(copy.skipped)) {
        return;
      }
      submittedRef.current = true;
      setError("");
      setTimedOut(timeout);
      startTransition(async () => {
        try {
          const result = await submitCandidateAssessmentAction(assignmentId, answers, {
            answerChanges: changesRef.current,
            pageExits: exitsRef.current,
            timedOut: timeout,
            userAgent: navigator.userAgent,
          });
          if (showResult && typeof result?.score === "number") {
            setScore(result.score);
          }
          setFinished(true);
        } catch {
          submittedRef.current = false;
          setError(copy.error);
        }
      });
    },
    [answeredCount, answers, assignmentId, copy.error, copy.skipped, questions.length, showResult],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      if (remaining === 0) submit(true);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, submit]);

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

  function toggleMultiple(questionId: number, optionIndex: number) {
    const key = String(questionId);
    const current = Array.isArray(answers[key]) ? [...(answers[key] as number[])] : [];
    const position = current.indexOf(optionIndex);
    if (position >= 0) current.splice(position, 1);
    else current.push(optionIndex);
    setAnswer(questionId, current);
  }

  if (finished) {
    return (
      <section className={`${shellClass}entrance-test-done`.trim()}>
        <h2>{copy.done}</h2>
        <p>{timedOut ? copy.timeout : copy.doneNote}</p>
        {score != null ? (
          <p className="lead">
            {t("st_result_score").replace("{score}", String(score))}
          </p>
        ) : null}
        {returnTo ? (
          <Link href={returnTo} className="btn btn-primary">
            {t("portal_back_home")}
          </Link>
        ) : null}
      </section>
    );
  }

  const question = questions[index];
  if (!question) return null;
  const key = String(question.id);
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = questions.length ? ((index + 1) / questions.length) * 100 : 0;

  return (
    <section className={`${shellClass}entrance-test`.trim()}>
      <div className="entrance-test-status">
        <strong>
          {copy.question} {index + 1} {copy.of} {questions.length}
        </strong>
        <span className={secondsLeft <= 300 ? "entrance-test-timer is-warning" : "entrance-test-timer"}>
          {copy.remaining}: {minutes}:{String(seconds).padStart(2, "0")}
        </span>
        <span>
          {copy.answered}: {answeredCount}/{questions.length}
        </span>
      </div>
      <div className="entrance-test-progress" aria-hidden>
        <span style={{ width: `${progress}%` }} />
      </div>

      <fieldset className="question entrance-test-question">
        <legend>{question.prompt}</legend>
        {question.type === "text" ? (
          <textarea
            rows={5}
            value={typeof answers[key] === "string" ? (answers[key] as string) : ""}
            placeholder={copy.written}
            onChange={(event) => setAnswer(question.id, event.target.value)}
          />
        ) : (
          <div className="options">
            {question.options.slice(0, 4).map((option, optionIndex) => {
              const selected =
                question.type === "multiple"
                  ? Array.isArray(answers[key]) &&
                    (answers[key] as number[]).includes(optionIndex)
                  : answers[key] === optionIndex;
              return (
                <label key={optionIndex} className={selected ? "option selected" : "option"}>
                  <input
                    type={question.type === "multiple" ? "checkbox" : "radio"}
                    name={`q-${question.id}`}
                    checked={selected}
                    onChange={() =>
                      question.type === "multiple"
                        ? toggleMultiple(question.id, optionIndex)
                        : setAnswer(question.id, optionIndex)
                    }
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      {error ? <p className="error">{error}</p> : null}
      <div className="actions-row entrance-test-actions">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={index === 0 || pending}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          {copy.back}
        </button>
        {index < questions.length - 1 ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}
          >
            {copy.next}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() => submit(false)}
          >
            {pending ? copy.saving : copy.finish}
          </button>
        )}
      </div>
    </section>
  );
}
