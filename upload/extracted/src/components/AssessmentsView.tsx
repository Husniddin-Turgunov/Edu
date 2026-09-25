"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AppShell, PageHeader } from "@/components/ui";
import {
  clearAssessmentsLibraryAction,
  createAssessmentAction,
  deleteSelectedAssessmentsAction,
  syncDriveTestsAction,
} from "@/db/actions";
import type { AssessmentTestKind } from "@/lib/drive-file-kind";
import { useI18n, type MessageKey } from "@/lib/i18n";

type TestRow = {
  id: number;
  title: string;
  audienceName: string;
  questionCount: number;
  durationMinutes: number;
  passScore: number;
};

const KIND_TITLE: Record<AssessmentTestKind, MessageKey> = {
  candidate: "tests_kind_candidate",
  trial: "tests_kind_trial",
  intern: "tests_kind_intern",
  level: "tests_kind_level",
};

const KIND_DRIVE_OK: Record<AssessmentTestKind, MessageKey> = {
  candidate: "tests_kind_candidate_drive_ok",
  trial: "tests_kind_trial_drive_ok",
  intern: "tests_kind_intern_drive_ok",
  level: "tests_kind_level_drive_ok",
};

export function AssessmentsView({
  tests,
  kind,
  audiences,
  driveConfigured = false,
}: {
  tests: TestRow[];
  kind: AssessmentTestKind;
  audiences: { id: number; name: string }[];
  driveConfigured?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [syncNote, setSyncNote] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  const allSelected = tests.length > 0 && selected.length === tests.length;

  function toggleAll() {
    setSelected(allSelected ? [] : tests.map((row) => row.id));
  }

  function toggleOne(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function syncDrive() {
    startTransition(async () => {
      const summary = await syncDriveTestsAction(kind);
      setSyncNote(summary.message);
      router.refresh();
    });
  }

  return (
    <AppShell pathname={`/assessments/kind/${kind}`}>
      <PageHeader title={t(KIND_TITLE[kind])} subtitle={t("assessments_title")} />

      <section className="stack" style={{ gap: 18, maxWidth: 960 }}>
        {kind === "candidate" ? (
          <article className="panel entrance-rules">
            <div>
              <p className="eyebrow">Правила входного теста</p>
              <h2>15 вопросов · максимум 25 минут</h2>
              <p className="muted">
                5 базовых вопросов, 5 рабочих ситуаций и 5 сложных вопросов.
                Результат рассчитывается автоматически; кандидат проходит
                только тест своей должности.
              </p>
            </div>
            <div className="entrance-levels">
              <span>0–39% · знания не подтверждены</span>
              <span>40–59% · возможен стажёром</span>
              <span>60–74% · Junior</span>
              <span>75–89% · Middle</span>
              <span>90–100% · сильный кандидат</span>
            </div>
          </article>
        ) : null}

        {kind === "candidate" ? (
          <details className="panel">
            <summary>
              <strong>Создать тест или загрузить Excel</strong>
            </summary>
            <form
              action={createAssessmentAction}
              className="stack-form"
              style={{ marginTop: 16 }}
            >
              <input type="hidden" name="source" value="candidate" />
              <label>
                Должность / название теста
                <input name="title" placeholder="Например: Бухгалтер" />
              </label>
              <label>
                Описание
                <textarea name="description" rows={2} />
              </label>
              <div className="layout-2" style={{ gap: 12 }}>
                <label>
                  Должность / аудитория
                  <select name="competencyId" required>
                    {audiences.map((audience) => (
                      <option key={audience.id} value={audience.id}>
                        {audience.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Время, минут
                  <input
                    name="durationMinutes"
                    type="number"
                    min={5}
                    max={25}
                    defaultValue={25}
                  />
                </label>
              </div>
              <label>
                Проходной порог, %
                <input
                  name="passScore"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={60}
                />
              </label>
              <label>
                Excel-файл с вопросами
                <input name="file" type="file" accept=".xlsx,.xls" />
              </label>
              <button type="submit" className="btn btn-primary">
                Создать входной тест
              </button>
            </form>
          </details>
        ) : null}
        <p style={{ margin: 0 }}>
          <Link href="/assessments" className="btn btn-ghost" prefetch={false}>
            ← {t("assessments_back_hub")}
          </Link>
        </p>

        <article className="panel">
          <h2>{t("drive_sync_title")}</h2>
          <p className="muted">
            {driveConfigured ? t(KIND_DRIVE_OK[kind]) : t("drive_sync_off")}
          </p>
          {syncNote ? <p className="muted">{syncNote}</p> : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!driveConfigured || pending}
            onClick={syncDrive}
          >
            {pending ? t("drive_syncing") : t("drive_sync_now")}
          </button>
        </article>

        <article className="panel table-wrap library-panel">
          <h2>
            {t("library")} · {tests.length}
          </h2>
          <form action={deleteSelectedAssessmentsAction}>
            <input type="hidden" name="kind" value={kind} />
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label={t("select_all_tests")}
                      disabled={tests.length === 0}
                    />
                  </th>
                  <th>№</th>
                  <th>{t("test")}</th>
                  <th>{t("col_audience")}</th>
                  <th>{t("questions")}</th>
                  <th>{t("duration_min")}</th>
                  {kind === "candidate" ? <th>Порог</th> : null}
                  <th />
                </tr>
              </thead>
              <tbody>
                {tests.length === 0 ? (
                  <tr>
                    <td colSpan={kind === "candidate" ? 8 : 7} className="muted">
                      —
                    </td>
                  </tr>
                ) : (
                  tests.map((row, i) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          type="checkbox"
                          name="assessmentIds"
                          value={row.id}
                          checked={selected.includes(row.id)}
                          onChange={() => toggleOne(row.id)}
                          aria-label={row.title}
                        />
                      </td>
                      <td className="muted">{i + 1}</td>
                      <td>
                        <strong>{row.title}</strong>
                      </td>
                      <td>{row.audienceName}</td>
                      <td>{row.questionCount}</td>
                      <td>
                        {row.durationMinutes} {t("min")}
                      </td>
                      {kind === "candidate" ? <td>{row.passScore}%</td> : null}
                      <td>
                        <Link
                          href={`/assessments/${row.id}`}
                          className="btn btn-primary"
                          prefetch={false}
                        >
                          {t("edit_test")}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {tests.length > 0 ? (
              <div className="actions-row" style={{ marginTop: 12 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={selected.length === 0}
                >
                  {t("delete_selected_tests")}
                  {selected.length > 0 ? ` (${selected.length})` : ""}
                </button>
                <button
                  type="submit"
                  formAction={clearAssessmentsLibraryAction}
                  className="btn btn-ghost"
                >
                  {t("clear_all_tests")}
                </button>
              </div>
            ) : null}
          </form>
        </article>
      </section>
    </AppShell>
  );
}
