"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell, PageHeader, type AppShellRole } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { useImportedContent } from "@/lib/imported-content-i18n";
import type { VerificationTest } from "@/lib/verification-tests";

export function ParticipantVerificationTakeView({
  test,
  participantKind,
  themeHue,
}: {
  test: VerificationTest;
  participantKind: "employee" | "intern";
  themeHue: number;
}) {
  const { t, locale } = useI18n();
  const role: AppShellRole =
    participantKind === "intern" ? "intern" : "employee";
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const localized = useImportedContent(
    [
      test.title,
      test.lessonTitle,
      test.summary,
      ...test.questions.flatMap((question) => [
        question.prompt,
        ...question.options,
      ]),
    ],
    locale,
  );

  const total = test.questions.length;
  const correct = test.questions.filter(
    (q) => answers[q.id] === q.correctIndex,
  ).length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  const allAnswered = test.questions.every((q) => answers[q.id] != null);

  return (
    <AppShell pathname="/my/tests" role={role} themeHue={themeHue}>
      <PageHeader
        title={localized(test.title)}
        subtitle={`${t("verify_from_lesson")}: ${localized(test.lessonTitle)}`}
      />

      {submitted ? (
        <section className="panel">
          <p className="eyebrow">{t("verify_result_title")}</p>
          <h2>
            {score}% · {correct}/{total}
          </h2>
          <p className="lead">
            {score >= 70
              ? t("verify_result_pass")
              : t("verify_result_retry")}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/my/tests" className="btn btn-primary">
              {t("verify_back_library")}
            </Link>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
              }}
            >
              {t("verify_retry")}
            </button>
            <Link href="/my/learning" className="btn">
              {t("verify_go_learning")}
            </Link>
          </div>
        </section>
      ) : (
        <section className="panel">
          <p className="muted" style={{ marginBottom: 16 }}>
            {localized(test.summary)}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!allAnswered) return;
              setSubmitted(true);
            }}
          >
            <div className="list">
              {test.questions.map((question, index) => (
                <article key={question.id} className="list-item" style={{ display: "block" }}>
                  <strong>
                    {index + 1}. {localized(question.prompt)}
                  </strong>
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {question.options.map((option, optionIndex) => {
                      const selected = answers[question.id] === optionIndex;
                      return (
                        <label
                          key={option}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            name={question.id}
                            checked={selected}
                            onChange={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [question.id]: optionIndex,
                              }))
                            }
                          />
                          <span>{localized(option)}</span>
                        </label>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!allAnswered}
              >
                {t("verify_submit")}
              </button>
              <Link href="/my/tests" className="btn">
                {t("verify_back_library")}
              </Link>
            </div>
          </form>
        </section>
      )}
    </AppShell>
  );
}
