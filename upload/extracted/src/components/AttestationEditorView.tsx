"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/ui";
import { AttestationReviewsPanel } from "@/components/AttestationReviewsPanel";
import {
  addQuestionAction,
  deleteQuestionAction,
  saveAttestationAction,
  updateQuestionAction,
} from "@/db/actions";
import { useI18n } from "@/lib/i18n";

type StaffRole = { id: string; label: string; department: string };
type LibraryTest = { id: number; title: string };
type Question = {
  id: number;
  prompt: string;
  type: "single" | "multiple" | "text";
  options: string[];
  correctIndexes: number[];
  keywords: string[];
  weight: number;
  difficulty: string;
  knowledgeKind: string;
  section: string;
};

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function QuestionEditor({
  assessmentId,
  returnTo,
  question,
  index,
}: {
  assessmentId: number;
  returnTo: string;
  question: Question;
  index: number;
}) {
  const { t } = useI18n();
  const [type, setType] = useState<"single" | "multiple" | "text">(question.type);
  const options = [...question.options];
  while (options.length < 4) options.push("");

  return (
    <article className="panel" style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <h3 style={{ margin: 0 }}>
          {t("question_n").replace("{n}", String(index + 1))}
        </h3>
        <form action={deleteQuestionAction}>
          <input type="hidden" name="questionId" value={question.id} />
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" className="btn btn-ghost">
            {t("delete_question")}
          </button>
        </form>
      </div>

      <form action={updateQuestionAction} className="stack-form">
        <input type="hidden" name="questionId" value={question.id} />
        <input type="hidden" name="assessmentId" value={assessmentId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="difficulty" value={question.difficulty} />

        <label>
          {t("question_prompt")}
          <textarea name="prompt" required rows={3} defaultValue={question.prompt} />
        </label>

        <div className="layout-2" style={{ gap: 12 }}>
          <label>
            {t("section_name")}
            <input name="section" required defaultValue={question.section} />
          </label>
          <label>
            {t("section_kind")}
            <select
              name="knowledgeKind"
              defaultValue={
                question.knowledgeKind === "aspiration" ? "aspiration" : "knowledge"
              }
            >
              <option value="knowledge">{t("kind_knowledge")}</option>
              <option value="aspiration">{t("kind_aspiration")}</option>
            </select>
          </label>
        </div>

        <div className="layout-2" style={{ gap: 12 }}>
          <label>
            {t("question_type")}
            <select
              name="type"
              value={type}
              onChange={(event) =>
                setType(event.target.value as "single" | "multiple" | "text")
              }
            >
              <option value="single">{t("q_type_single")}</option>
              <option value="multiple">{t("q_type_multiple")}</option>
              <option value="text">{t("q_type_text")}</option>
            </select>
          </label>
          <label>
            {t("weight")}
            <input name="weight" type="number" min={0} defaultValue={question.weight} />
          </label>
        </div>

        {type === "text" ? (
          <label>
            {t("keywords")}
            <input name="keywords" defaultValue={question.keywords.join(", ")} />
          </label>
        ) : (
          <div className="options-editor">
            <strong>{t("options")}</strong>
            {options.map((opt, idx) => (
              <div key={idx} className="option-row">
                <label className="option-correct">
                  <input
                    type={type === "single" ? "radio" : "checkbox"}
                    name="correctIndex"
                    value={idx}
                    defaultChecked={question.correctIndexes.includes(idx)}
                  />
                  <span>{t("correct_mark")}</span>
                </label>
                <input
                  name="option"
                  defaultValue={opt}
                  placeholder={`${t("option")} ${idx + 1}`}
                />
              </div>
            ))}
          </div>
        )}

        <button type="submit" className="btn btn-primary">
          {t("save_question")}
        </button>
      </form>
    </article>
  );
}

export function AttestationEditorView({
  attestation,
  questions,
  assessmentId,
  staffRoles,
  libraryTests,
  employees,
  reviews,
}: {
  attestation: {
    id: number;
    title: string;
    description: string;
    department: string;
    positionTitles: string[];
    startsAt: string;
    endsAt: string;
    durationMinutes: number;
    passingScore: number;
    isActive: boolean;
    usesLibraryTest: boolean;
    libraryTestTitle: string | null;
  };
  questions: Question[];
  assessmentId: number | null;
  staffRoles: StaffRole[];
  libraryTests: LibraryTest[];
  employees: {
    id: number;
    name: string;
    roleTitle: string;
    department: string;
    currentLevel: string;
    targetLevel: string;
  }[];
  reviews: {
    id: number;
    type: string;
    status: string;
    scheduledAt: string;
    finalScore: number | null;
    decision: string;
    protocolNumber: string | null;
    employeeId: number;
    employeeName: string;
    roleTitle: string;
    department: string;
    currentLevel: string;
    targetLevel: string;
  }[];
}) {
  const { t } = useI18n();
  const departments = useMemo(
    () => [...new Set(staffRoles.map((role) => role.department).filter(Boolean))],
    [staffRoles],
  );
  const [department, setDepartment] = useState(attestation.department);
  const [libraryId, setLibraryId] = useState(
    attestation.usesLibraryTest && assessmentId ? String(assessmentId) : "",
  );
  const returnTo = `/attestation/${attestation.id}`;
  const departmentRoles = useMemo(
    () => staffRoles.filter((role) => role.department === department),
    [department, staffRoles],
  );
  const selected = new Set(attestation.positionTitles);

  return (
    <AppShell pathname="/attestation">
      <PageHeader
        title={attestation.title}
        subtitle={`${attestation.department || t("admin_attest_unassigned")} · ${questions.length} ${t("questions")}`}
      />

      <p style={{ marginBottom: 14 }}>
        <Link href="/attestation" className="btn btn-ghost">
          ← {t("admin_attest_back")}
        </Link>
      </p>

      <article className="panel" style={{ marginBottom: 18, maxWidth: 960 }}>
        <form action={saveAttestationAction} className="stack-form">
          <input type="hidden" name="attestationId" value={attestation.id} />
          <label>
            {t("admin_field_title")}
            <input name="title" required defaultValue={attestation.title} />
          </label>
          <label>
            {t("admin_attest_department")}
            <select
              name="department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
            >
              <option value="">{t("admin_attest_unassigned")}</option>
              {departments.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("test_description")}
            <textarea
              name="description"
              rows={2}
              defaultValue={attestation.description}
            />
          </label>
          <div className="layout-2" style={{ gap: 12 }}>
            <label>
              {t("admin_attest_starts")}
              <input
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={toLocalInputValue(attestation.startsAt)}
              />
            </label>
            <label>
              {t("admin_attest_ends")}
              <input
                name="endsAt"
                type="datetime-local"
                required
                defaultValue={toLocalInputValue(attestation.endsAt)}
              />
            </label>
          </div>
          <div className="layout-2" style={{ gap: 12 }}>
            <label>
              {t("admin_attest_duration")}
              <input
                name="durationMinutes"
                type="number"
                min={5}
                defaultValue={attestation.durationMinutes}
              />
            </label>
            <label>
              {t("admin_attest_pass")}
              <input
                name="passingScore"
                type="number"
                min={1}
                max={100}
                defaultValue={attestation.passingScore}
              />
            </label>
          </div>
          <label>
            {t("admin_attest_source")}
            <select
              name="libraryAssessmentId"
              value={libraryId}
              onChange={(event) => setLibraryId(event.target.value)}
            >
              <option value="">{t("admin_attest_own_questions")}</option>
              {libraryTests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.title}
                </option>
              ))}
            </select>
          </label>
          <label className="attest-position-item">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={attestation.isActive}
            />
            <span>{t("admin_attest_published")}</span>
          </label>
          <fieldset className="attest-positions">
            <legend>{t("admin_attest_positions")}</legend>
            <p className="muted">{t("admin_attest_positions_hint")}</p>
            {departmentRoles.length === 0 ? (
              <p className="muted">{t("admin_attest_no_positions")}</p>
            ) : (
              departmentRoles.map((role) => (
                <label key={role.id} className="attest-position-item">
                  <input
                    type="checkbox"
                    name="positionTitle"
                    value={role.id}
                    defaultChecked={selected.has(role.id)}
                  />
                  <span>{role.label}</span>
                </label>
              ))
            )}
          </fieldset>
          <button className="btn btn-primary" type="submit">
            {t("admin_learning_save")}
          </button>
        </form>
      </article>

      <AttestationReviewsPanel
        attestationId={attestation.id}
        startsAt={attestation.startsAt}
        employees={employees}
        reviews={reviews}
      />

      <section style={{ maxWidth: 960 }}>
        <h2 style={{ marginBottom: 12 }}>
          {t("questions_list")} · {questions.length}
        </h2>
        {attestation.usesLibraryTest ? (
          <article className="panel">
            <p className="lead">
              {t("admin_attest_linked")}: {attestation.libraryTestTitle}
            </p>
            <p className="muted">{t("admin_attest_library_note")}</p>
            {assessmentId ? (
              <Link href={`/assessments/${assessmentId}`} className="btn">
                {t("admin_attest_open_library_test")}
              </Link>
            ) : null}
          </article>
        ) : !assessmentId ? (
          <p className="muted">{t("admin_attest_no_questions")}</p>
        ) : (
          <>
            {questions.length === 0 ? (
              <p className="muted">{t("admin_attest_no_questions")}</p>
            ) : (
              questions.map((question, index) => (
                <QuestionEditor
                  key={question.id}
                  assessmentId={assessmentId}
                  returnTo={returnTo}
                  question={question}
                  index={index}
                />
              ))
            )}
            <article className="panel">
              <h3>{t("add_question")}</h3>
              <form action={addQuestionAction} className="stack-form">
                <input type="hidden" name="assessmentId" value={assessmentId} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="difficulty" value="junior" />
                <label>
                  {t("question_prompt")}
                  <textarea name="prompt" required rows={3} />
                </label>
                <div className="layout-2" style={{ gap: 12 }}>
                  <label>
                    {t("section_name")}
                    <input name="section" defaultValue="Общий" />
                  </label>
                  <label>
                    {t("question_type")}
                    <select name="type" defaultValue="single">
                      <option value="single">{t("q_type_single")}</option>
                      <option value="multiple">{t("q_type_multiple")}</option>
                      <option value="text">{t("q_type_text")}</option>
                    </select>
                  </label>
                </div>
                <div className="options-editor">
                  <strong>{t("options")}</strong>
                  {[0, 1, 2, 3].map((idx) => (
                    <div key={idx} className="option-row">
                      <label className="option-correct">
                        <input
                          type="radio"
                          name="correctIndex"
                          value={idx}
                          defaultChecked={idx === 0}
                        />
                        <span>{t("correct_mark")}</span>
                      </label>
                      <input
                        name="option"
                        placeholder={`${t("option")} ${idx + 1}`}
                      />
                    </div>
                  ))}
                </div>
                <button type="submit" className="btn btn-primary">
                  {t("add_question")}
                </button>
              </form>
            </article>
          </>
        )}
      </section>
    </AppShell>
  );
}
