"use client";

import Link from "next/link";
import { AppShell, PageHeader } from "@/components/ui";
import { CandidateEntranceTestForm } from "@/components/CandidateEntranceTestForm";
import { useI18n } from "@/lib/i18n";

type Data = {
  id: number;
  status: string;
  candidateId: number;
  candidateName: string;
  assessmentTitle: string;
  durationMinutes: number;
  expiresAt: string;
  roleTitle: string;
  showResultToCandidate?: boolean;
  questions: {
    id: number;
    prompt: string;
    type?: "single" | "multiple" | "text";
    options: string[];
  }[];
};

export function TakeCandidateView({ data }: { data: Data }) {
  const { t } = useI18n();

  if (data.status === "completed") {
    return (
      <AppShell pathname="/candidates">
        <PageHeader title={t("already_done")} />
        <section className="panel">
          <p>{t("already_done_note")}</p>
          <Link href="/candidates" className="btn btn-primary">
            {t("to_candidates")}
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell pathname="/candidates">
      <PageHeader
        title={t("take_title")}
        subtitle={`${data.assessmentTitle} · ${data.roleTitle} · ~${data.durationMinutes} ${t("min")}`}
      />
      <CandidateEntranceTestForm
        assignmentId={data.id}
        questions={data.questions}
        expiresAt={data.expiresAt}
        showResult={data.showResultToCandidate}
      />
    </AppShell>
  );
}
