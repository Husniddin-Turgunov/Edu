"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmTerminalAction } from "@/db/actions";
import { TerminalTakeForm } from "@/components/TerminalTakeForm";
import { useI18n } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

type TerminalCandidateInfo = {
  id: number;
  name: string;
  roleTitle: string;
  department: string;
  vacancyCode: string;
  avatarHue: number;
};

type TerminalQueueRow = {
  id: number;
  candidateName: string;
  roleTitle: string;
  status: string;
};

type Question = {
  id: number;
  prompt: string;
  type?: "single" | "multiple" | "text";
  options: string[];
};

export type TerminalViewState =
  | { phase: "idle"; slotNumber: number; queue: TerminalQueueRow[] }
  | {
      phase: "confirm";
      slotNumber: number;
      queueItemId: number;
      candidate: TerminalCandidateInfo;
      queue: TerminalQueueRow[];
    }
  | {
      phase: "testing";
      slotNumber: number;
      queueItemId: number;
      assignmentId: number;
      candidate: TerminalCandidateInfo;
      take: {
        assessmentTitle: string;
        questions: Question[];
      };
      clock: {
        serverNow: number;
        startedAt: string;
        expiresAt: string;
        warnAt: number;
      };
      queue: TerminalQueueRow[];
    };

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TerminalView({ state }: { state: TerminalViewState }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.phase === "testing") return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [state.phase, router]);

  return (
    <div className="terminal-shell">
      <header className="terminal-header">
        <div className="terminal-brand">
          <span className="terminal-slot-badge">
            {t("terminal_place")} {state.slotNumber}
          </span>
        </div>
      </header>

      <main className="terminal-main">
        {state.phase === "idle" ? (
          <section className="terminal-card terminal-idle">
            <h1>{t("terminal_idle_title")}</h1>
            <p className="muted">{t("terminal_idle_note")}</p>
            {state.queue.length > 0 ? (
              <div className="terminal-queue-preview">
                <h2>{t("terminal_queue_next")}</h2>
                <ul>
                  {state.queue.map((q) => (
                    <li key={q.id}>
                      {localizeStaffText(q.candidateName, locale, "name")} —{" "}
                      {localizeStaffText(q.roleTitle, locale, "role")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {state.phase === "confirm" ? (
          <section className="terminal-card terminal-confirm">
            <p className="eyebrow">{t("terminal_confirm_eyebrow")}</p>
            <div className="terminal-person">
              <span
                className="avatar terminal-avatar"
                style={{
                  background: `hsl(${state.candidate.avatarHue} 42% 38%)`,
                }}
              >
                {initials(
                  localizeStaffText(state.candidate.name, locale, "name"),
                )}
              </span>
              <div>
                <h1>
                  {localizeStaffText(state.candidate.name, locale, "name")}
                </h1>
                <p className="lead">
                  {localizeStaffText(
                    state.candidate.roleTitle,
                    locale,
                    "role",
                  )}
                </p>
                <p className="muted">
                  {localizeStaffText(
                    state.candidate.department,
                    locale,
                    "department",
                  )}
                  {state.candidate.vacancyCode
                    ? ` · ${state.candidate.vacancyCode}`
                    : ""}
                </p>
              </div>
            </div>
            <p className="muted">{t("terminal_confirm_note")}</p>
            {error ? <p className="error">{error}</p> : null}
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  try {
                    await confirmTerminalAction(
                      state.slotNumber,
                      state.queueItemId,
                    );
                    router.refresh();
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : t("save_fail"),
                    );
                  }
                });
              }}
            >
              {pending ? t("saving") : t("terminal_confirm_btn")}
            </button>
          </section>
        ) : null}

        {state.phase === "testing" ? (
          <TerminalTakeForm
            slotNumber={state.slotNumber}
            queueItemId={state.queueItemId}
            assignmentId={state.assignmentId}
            title={state.take.assessmentTitle}
            personName={localizeStaffText(
              state.candidate.name,
              locale,
              "name",
            )}
            roleTitle={localizeStaffText(
              state.candidate.roleTitle,
              locale,
              "role",
            )}
            questions={state.take.questions}
            clock={state.clock}
          />
        ) : null}
      </main>
    </div>
  );
}
