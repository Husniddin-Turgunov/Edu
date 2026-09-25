"use client";

import { useState } from "react";
import Link from "next/link";
import { ExpandOnClick } from "@/components/ExpandOnClick";
import { AppShell, PageHeader, type AppShellRole } from "@/components/ui";
import {
  markLessonLearnedAction,
  updateLessonWorkflowAction,
} from "@/db/actions";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useImportedContent } from "@/lib/imported-content-i18n";
import { levelLabel } from "@/lib/levels";

const STATUS_KEYS: Record<string, MessageKey> = {
  not_started: "learn_status_not_started",
  studying: "learn_status_studying",
  submitted: "learn_status_submitted",
  returned: "learn_status_returned",
  fixing: "learn_status_fixing",
  accepted: "learn_status_accepted",
  recheck: "learn_status_recheck",
  credited: "learn_status_credited",
};

const PATH_KEYS: Record<string, MessageKey> = {
  full: "learn_path_full",
  check_only: "learn_path_check",
  hard_case: "learn_path_hard",
  skip: "learn_path_skip",
};

export function ParticipantLessonDetailView({
  lesson,
  completed,
  hasTest,
  linkedTestSlug,
  participantKind,
  themeHue,
  workflow,
  pathMode = "full",
}: {
  lesson: {
    dbId: number;
    id: string;
    title: string;
    summary: string;
    content: string;
    contentFormat?: "text" | "html";
    level: string;
    durationMin: number;
    goal?: string;
    material?: string;
    example?: string;
    instruction?: string;
    practice?: string;
    criteria?: string;
    programMonth?: number;
  };
  completed: boolean;
  hasTest: boolean;
  linkedTestSlug: string | null;
  participantKind: "employee" | "intern";
  themeHue: number;
  workflow: {
    status: string;
    answerText: string;
    answerFileUrl: string;
    mentorComment: string;
    deadlineAt: string | null;
  } | null;
  pathMode?: string;
}) {
  const { t, locale } = useI18n();
  const role: AppShellRole =
    participantKind === "intern" ? "intern" : "employee";
  const isHtml = lesson.contentFormat === "html";
  const localized = useImportedContent(
    [
      lesson.title,
      lesson.summary,
      lesson.content,
      lesson.goal ?? "",
      lesson.material ?? "",
      lesson.example ?? "",
      lesson.instruction ?? "",
      lesson.practice ?? "",
      lesson.criteria ?? "",
      workflow?.mentorComment ?? "",
    ],
    locale,
  );
  const title = localized(lesson.title);
  const summary = localized(lesson.summary);
  const content = localized(lesson.content);
  const status = workflow?.status || (completed ? "credited" : "not_started");
  const statusKey = STATUS_KEYS[status] ?? "learn_status_not_started";
  const pathKey = PATH_KEYS[pathMode] ?? "learn_path_full";
  const skipBasic = pathMode === "check_only" || pathMode === "skip";
  const showFullMaterial = !skipBasic;
  const answerIsUnderReview = status === "submitted" || status === "recheck";
  const deadlineAt = workflow?.deadlineAt ?? null;
  const overdue =
    participantKind === "employee" &&
    Boolean(deadlineAt) &&
    new Date(deadlineAt as string).getTime() < Date.now() &&
    status !== "credited" &&
    status !== "accepted";
  const dueSoon =
    Boolean(deadlineAt) &&
    !overdue &&
    status !== "credited" &&
    status !== "accepted" &&
    new Date(deadlineAt as string).getTime() - Date.now() <=
      3 * 24 * 60 * 60 * 1000;
  const lessonStep: "material" | "practice" | "review" | "test" =
    status === "credited" || status === "accepted"
      ? hasTest
        ? "test"
        : "review"
      : status === "submitted" || status === "recheck"
        ? "review"
        : status === "returned" || status === "fixing" || status === "studying"
          ? "practice"
          : skipBasic
            ? hasTest
              ? "test"
              : "practice"
            : "material";
  const steps = (
    [
      { id: "material", key: "eh_learn_step_material" },
      { id: "practice", key: "eh_learn_step_practice" },
      { id: "review", key: "eh_learn_step_review" },
      ...(hasTest ? [{ id: "test", key: "eh_learn_step_test" } as const] : []),
    ] as const
  );

  function Section({
    heading,
    body,
    html,
  }: {
    heading: string;
    body: string;
    html?: boolean;
  }) {
    const text = body.trim();
    const long = html || text.length > 360;
    const [open, setOpen] = useState(!long);
    if (!text) return null;
    return (
      <div className="learn-lesson-section">
        <h3>{heading}</h3>
        {!open ? (
          <>
            <p className="muted">{t("eh_long_hint")}</p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setOpen(true)}
            >
              {t("eh_long_show")}
            </button>
          </>
        ) : html ? (
          <div
            className="lesson-body lesson-body-html"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : (
          <div className="lesson-body" style={{ whiteSpace: "pre-wrap" }}>
            {body}
          </div>
        )}
      </div>
    );
  }

  return (
    <AppShell pathname="/my/learning" role={role} themeHue={themeHue}>
      <PageHeader
        title={title}
        subtitle={`${
          lesson.level === "all"
            ? t("learn_filter_all")
            : levelLabel(lesson.level)
        } · ${lesson.durationMin} ${t("min")}${
          lesson.programMonth ? ` · ${t("learn_month")} ${lesson.programMonth}` : ""
        }`}
      />

      <section className="panel" style={{ maxWidth: 820 }}>
        <div className="learn-status-row">
          <span
            className={
              overdue
                ? "learn-status learn-status-overdue"
                : `learn-status learn-status-${status}`
            }
          >
            {overdue ? t("eh_learn_overdue") : t(statusKey)}
          </span>
          <span className="learn-meta-chip">{t(pathKey)}</span>
          {deadlineAt ? (
            <span
              className={
                overdue
                  ? "learn-status learn-status-overdue"
                  : dueSoon
                    ? "learn-status learn-status-soon"
                    : "learn-meta-chip"
              }
            >
              {dueSoon ? `${t("eh_learn_due_soon")} · ` : ""}
              {t("learn_field_deadline")}:{" "}
              {new Date(deadlineAt).toLocaleDateString(
                locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU",
              )}
            </span>
          ) : null}
        </div>

        {participantKind === "employee" && pathMode !== "skip" ? (
          <div className="learn-steps" aria-label={t("eh_learn_path_label")}>
            {steps.map((step, index) => {
              const order = steps.findIndex((item) => item.id === lessonStep);
              const done = index < order;
              const current = step.id === lessonStep;
              return (
                <div
                  key={step.id}
                  className={
                    current
                      ? "learn-step is-current"
                      : done
                        ? "learn-step is-done"
                        : "learn-step"
                  }
                >
                  <span>
                    {index + 1}. {t(step.key)}
                  </span>
                  <strong>
                    {current
                      ? t("eh_learn_next_action")
                      : done
                        ? t("eh_check_done")
                        : t("eh_check_todo")}
                  </strong>
                </div>
              );
            })}
          </div>
        ) : null}

        {!hasTest ? (
          <div className="learn-alert" role="status" style={{ marginBottom: 16 }}>
            <strong>{t("learn_no_test_title")}</strong>
            <p style={{ margin: "6px 0 0" }}>
              {t("learn_no_test_note").replace("{title}", title)}
            </p>
          </div>
        ) : null}

        {skipBasic ? (
          <p className="lead">{t("learn_skip_basic_note")}</p>
        ) : (
          <p className="lead">{summary}</p>
        )}

        <Section heading={t("learn_field_goal")} body={localized(lesson.goal ?? "")} />
        {showFullMaterial ? (
          <>
            <Section
              heading={t("learn_field_material")}
              body={localized(lesson.material || "")}
            />
            <Section
              heading={t("learn_field_example")}
              body={localized(lesson.example ?? "")}
            />
            <Section
              heading={t("learn_field_instruction")}
              body={localized(lesson.instruction ?? "")}
            />
          </>
        ) : null}
        <Section
          heading={t("learn_field_practice")}
          body={localized(lesson.practice ?? "")}
        />
        <Section
          heading={t("learn_field_criteria")}
          body={localized(lesson.criteria ?? "")}
        />

        {showFullMaterial &&
        !lesson.material &&
        !lesson.practice &&
        (content.trim() || summary.trim()) ? (
          <ExpandOnClick hint={t("eh_long_hint")} action={t("eh_long_show")}>
            {isHtml ? (
              <div
                className="lesson-body lesson-body-html"
                dangerouslySetInnerHTML={{
                  __html: content || `<p>${summary}</p>`,
                }}
              />
            ) : (
              <div
                className="lesson-body"
                style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}
              >
                {content || summary}
              </div>
            )}
          </ExpandOnClick>
        ) : null}

        {participantKind === "employee" &&
        overdue ? (
          <div className="learn-alert" role="status" style={{ marginBottom: 16 }}>
            <strong>{t("eh_learn_overdue")}</strong>
            <p style={{ margin: "6px 0 0" }}>{t("eh_learn_deadline_passed")}</p>
          </div>
        ) : null}

        {workflow?.mentorComment ? (
          <div className="learn-mentor-comment">
            <h3>{t("learn_field_mentor_comment")}</h3>
            <p>{localized(workflow.mentorComment)}</p>
          </div>
        ) : null}

        {participantKind === "employee" &&
        pathMode !== "skip" &&
        answerIsUnderReview ? (
          <div className="learn-alert" role="status" style={{ marginTop: 20 }}>
            <strong>{t("learn_submit_success")}</strong>
            <p style={{ margin: "6px 0 0" }}>
              {t("learn_submit_success_note")}
            </p>
          </div>
        ) : participantKind === "employee" && pathMode !== "skip" ? (
          <form
            action={updateLessonWorkflowAction}
            className="stack-form learn-practice-form"
            style={{ marginTop: 20 }}
          >
            <input type="hidden" name="lessonId" value={lesson.dbId} />
            <input type="hidden" name="status" value="submitted" />
            <label>
              {t("learn_field_answer")}
              <textarea
                name="answerText"
                rows={4}
                required
                defaultValue={workflow?.answerText ?? ""}
                placeholder={t("learn_field_answer_ph")}
              />
            </label>
            <label>
              {t("learn_field_answer_file")}
              <input
                name="answerFileUrl"
                defaultValue={workflow?.answerFileUrl ?? ""}
                placeholder="https://"
              />
            </label>
            <button type="submit" className="btn btn-primary">
              {t("learn_submit_practice")}
            </button>
            {hasTest ? (
              <p className="muted" style={{ margin: "10px 0 0" }}>
                {t("learn_practice_unlock_hint")}
              </p>
            ) : null}
          </form>
        ) : null}

        <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {completed || status === "credited" || status === "accepted" ? (
            <>
              <p className="muted" style={{ margin: 0 }}>
                {t("learn_already_done")}
              </p>
              {hasTest && linkedTestSlug ? (
                <Link
                  href={`/my/tests/check/${linkedTestSlug}`}
                  className="btn btn-primary"
                >
                  {t("learn_go_test")}
                </Link>
              ) : (
                <Link href="/my/tests" className="btn btn-primary">
                  {t("learn_go_test")}
                </Link>
              )}
            </>
          ) : hasTest ? (
            <form action={markLessonLearnedAction}>
              <input type="hidden" name="lessonId" value={lesson.dbId} />
              <button type="submit" className="btn btn-primary">
                {skipBasic ? t("learn_go_check_test") : t("learn_mark_done")}
              </button>
            </form>
          ) : (
            <form action={updateLessonWorkflowAction}>
              <input type="hidden" name="lessonId" value={lesson.dbId} />
              <input type="hidden" name="status" value="studying" />
              <button type="submit" className="btn btn-primary">
                {t("learn_start_studying")}
              </button>
            </form>
          )}
          <Link href="/my/learning" className="btn">
            {t("learn_back")}
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
