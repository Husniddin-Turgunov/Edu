"use client";

import Image from "next/image";
import Link from "next/link";
import { AppShell, PageHeader } from "@/components/ui";
import { TakeAssessmentForm } from "@/components/TakeAssessmentForm";
import { useI18n } from "@/lib/i18n";

type Data = {
  id: number;
  status: string;
  employeeId: number;
  employeeName: string;
  assessmentTitle: string;
  durationMinutes: number;
  questions: {
    id: number;
    prompt: string;
    type?: "single" | "multiple" | "text";
    options: string[];
  }[];
};

export function TakeView({ data }: { data: Data }) {
  const { t } = useI18n();

  if (data.status === "completed") {
    return (
      <AppShell pathname="/assessments">
        <PageHeader title={t("already_done")} />
        <section className="panel">
          <p>{t("already_done_note")}</p>
          <Link
            href={`/employees/${data.employeeId}`}
            className="btn btn-primary"
          >
            {t("to_profile")}
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell pathname="/assessments">
      <PageHeader
        title={t("take_title")}
        subtitle={`${data.assessmentTitle} · ~${data.durationMinutes} ${t("min")}`}
      />
      <section className="corp-doc corp-exam">
        <header className="corp-letterhead">
          <div className="corp-brand-row">
            <Image
              src="/akela-logo.png?v=nobox"
              alt="AKELA GROUP"
              width={140}
              height={80}
              className="corp-logo"
              unoptimized
            />
            <div className="corp-brand-text">
              <p className="corp-org">AKELA GROUP</p>
              <p className="corp-doc-title">{data.assessmentTitle}</p>
              <p className="corp-doc-meta">
                {t("employee_label")}: {data.employeeName} · ~{data.durationMinutes}{" "}
                {t("min")}
              </p>
            </div>
          </div>
          <div className="corp-stamp">{t("corp_exam_sheet")}</div>
        </header>
        <TakeAssessmentForm
          assignmentId={data.id}
          title={data.assessmentTitle}
          personName={data.employeeName}
          questions={data.questions}
          formal
        />
      </section>
    </AppShell>
  );
}
