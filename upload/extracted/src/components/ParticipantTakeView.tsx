"use client";

import Link from "next/link";
import { AppShell } from "@/components/ui";
import { ParticipantShell } from "@/components/ParticipantShell";
import { CandidateEntranceTestForm } from "@/components/CandidateEntranceTestForm";
import { TakeAssessmentForm } from "@/components/TakeAssessmentForm";
import { useI18n } from "@/lib/i18n";
import { useImportedContent } from "@/lib/imported-content-i18n";
import { localizeStaffText } from "@/lib/staff-localization";

type Data = {
  id: number;
  status: string;
  personName: string;
  assessmentTitle: string;
  durationMinutes: number;
  roleTitle: string;
  expiresAt?: string;
  mode: "candidate" | "employee";
  showResultToCandidate?: boolean;
  questions: {
    id: number;
    prompt: string;
    type?: "single" | "multiple" | "text";
    options: string[];
  }[];
};

export function ParticipantTakeView({
  data,
  themeHue = 220,
  shellRole = "employee",
}: {
  data: Data;
  themeHue?: number;
  shellRole?: "employee" | "intern" | "candidate";
}) {
  const { t, locale } = useI18n();
  const useAppShell = shellRole === "employee" || shellRole === "intern";
  const localized = useImportedContent(
    [
      data.assessmentTitle,
      ...data.questions.flatMap((question) => [
        question.prompt,
        ...question.options,
      ]),
    ],
    locale,
  );
  const localizedTitle = localized(data.assessmentTitle);
  const localizedQuestions = data.questions.map((question) => ({
    ...question,
    prompt: localized(question.prompt),
    options: question.options.map(localized),
  }));

  const body =
    data.status === "completed" ? (
      <section className={useAppShell ? "panel" : "portal-card"}>
        <h1>{t("already_done")}</h1>
        <p>{t("already_done_note")}</p>
        <Link href={useAppShell ? "/my/tests" : "/my"} className="btn btn-primary">
          {t("portal_back_home")}
        </Link>
      </section>
    ) : data.mode === "candidate" && data.expiresAt ? (
      <section className="portal-card portal-card-wide">
        <p className="eyebrow">
          {localizeStaffText(data.roleTitle, locale, "role")}
        </p>
        <h1>{localizedTitle}</h1>
        <p className="muted">
          {localizedQuestions.length} {t("questions")} · {data.durationMinutes}{" "}
          {t("min")}
        </p>
        <CandidateEntranceTestForm
          assignmentId={data.id}
          questions={localizedQuestions}
          expiresAt={data.expiresAt}
          returnTo="/my"
          embedded
          showResult={data.showResultToCandidate}
        />
      </section>
    ) : (
      <section className={useAppShell ? "panel" : "portal-card portal-card-wide"}>
        <p className="eyebrow">
          {localizeStaffText(data.roleTitle, locale, "role")}
        </p>
        <h1>{localizedTitle}</h1>
        <p className="muted">
          ~{data.durationMinutes} {t("min")}
        </p>
        <TakeAssessmentForm
          assignmentId={data.id}
          title={localizedTitle}
          personName={data.personName}
          personLabelKey="employee_label"
          questions={localizedQuestions}
          mode="employee"
          returnTo={useAppShell ? "/my/tests" : "/my"}
        />
      </section>
    );

  if (useAppShell) {
    return (
      <AppShell
        pathname="/my/tests"
        role={shellRole}
        themeHue={themeHue}
      >
        {body}
      </AppShell>
    );
  }

  return (
    <ParticipantShell
      pathname="/my/tests"
      themeHue={themeHue}
      showProfileNav={false}
    >
      {body}
    </ParticipantShell>
  );
}
