"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  submitAssessmentAction,
  submitCandidateAssessmentAction,
} from "@/db/actions";
import { KnowledgeProfileCard } from "@/components/KnowledgeProfileCard";
import { useI18n } from "@/lib/i18n";
import { levelLabel } from "@/lib/levels";
import type { AnswerValue, KnowledgeProfile } from "@/lib/scoring";

type Question = {
  id: number;
  prompt: string;
  type?: "single" | "multiple" | "text";
  options: string[];
};

export function TakeAssessmentForm({
  assignmentId,
  title,
  personName,
  personLabelKey = "employee_label",
  questions,
  mode = "employee",
  formal = false,
  returnTo,
}: {
  assignmentId: number;
  title: string;
  personName: string;
  personLabelKey?: "employee_label" | "candidate_label";
  questions: Question[];
  mode?: "employee" | "candidate";
  formal?: boolean;
  returnTo?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [result, setResult] = useState<{
    score: number;
    levelCode: string;
    nextSteps?: string;
    profile?: KnowledgeProfile | null;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function isAnswered(q: Question) {
    const a = answers[String(q.id)];
    const type = q.type || "single";
    if (type === "text") return typeof a === "string" && a.trim().length > 0;
    if (type === "multiple") return Array.isArray(a) && a.length > 0;
    return typeof a === "number";
  }

  const allAnswered = questions.every(isAnswered);

  function toggleMultiple(qId: number, optIdx: number) {
    const key = String(qId);
    setAnswers((prev) => {
      const cur = Array.isArray(prev[key]) ? [...(prev[key] as number[])] : [];
      const pos = cur.indexOf(optIdx);
      if (pos >= 0) cur.splice(pos, 1);
      else cur.push(optIdx);
      return { ...prev, [key]: cur };
    });
  }

  function onSubmit() {
    if (!allAnswered) {
      setError(t("answer_all"));
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res =
          mode === "candidate"
            ? await submitCandidateAssessmentAction(assignmentId, answers)
            : await submitAssessmentAction(assignmentId, answers);
        setResult({
          score: res.score,
          levelCode: res.levelCode,
          nextSteps: res.level?.nextSteps,
          profile: res.profile ?? null,
        });
      } catch {
        setError(t("save_fail"));
      }
    });
  }

  if (result) {
    return (
      <section className="panel result-panel">
        <p className="eyebrow">{t("result")}</p>
        <h2>
          {personName}: {result.score}%
        </h2>
        <p className="lead">
          {t("level")}: <strong>{levelLabel(result.levelCode)}</strong>
        </p>
        {result.profile ? (
          <KnowledgeProfileCard profile={result.profile} />
        ) : null}
        {result.nextSteps ? (
          <div className="next-steps">
            <h3>{t("next_steps")}</h3>
            <p>{result.nextSteps}</p>
          </div>
        ) : null}
        <div className="actions-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              router.push(
                returnTo ??
                  (mode === "candidate" ? "/candidates" : "/employees"),
              )
            }
          >
            {returnTo === "/my"
              ? t("portal_back_home")
              : mode === "candidate"
                ? t("to_candidates")
                : t("to_employees")}
          </button>
          {!returnTo ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                router.push(
                  mode === "candidate" ? "/candidates" : "/assessments",
                )
              }
            >
              {mode === "candidate" ? t("to_candidates") : t("to_tests")}
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className={formal ? "corp-exam-body" : "panel"}>
      {!formal ? (
        <>
          <p className="eyebrow">{t("taking")}</p>
          <h2>{title}</h2>
          <p className="muted">
            {t(personLabelKey)}: {personName}
          </p>
        </>
      ) : (
        <p className="corp-instruction">{t("corp_exam_instruction")}</p>
      )}

      <div className="question-list">
        {questions.map((q, index) => {
          const type = q.type || "single";
          const key = String(q.id);
          return (
            <fieldset key={q.id} className="question">
              <legend>
                {index + 1}. {q.prompt}
                {type === "multiple" ? (
                  <span className="muted"> ({t("q_type_multiple")})</span>
                ) : null}
                {type === "text" ? (
                  <span className="muted"> ({t("q_type_text")})</span>
                ) : null}
              </legend>

              {type === "text" ? (
                <textarea
                  rows={4}
                  value={typeof answers[key] === "string" ? (answers[key] as string) : ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder={t("written_answer")}
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
                              setAnswers((prev) => ({
                                ...prev,
                                [key]: optIdx,
                              }));
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
        })}
      </div>

      {error ? <p className="error">{error}</p> : null}

      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={onSubmit}
      >
        {pending ? t("saving") : t("finish")}
      </button>
    </section>
  );
}
