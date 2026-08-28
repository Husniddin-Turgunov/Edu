"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/ui";
import {
  addQuestionAction,
  deleteQuestionAction,
  updateAssessmentAction,
  updateQuestionAction,
} from "@/db/actions";
import { useI18n } from "@/lib/i18n";
import { entranceSection } from "@/lib/entrance-test";

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
  isActive: boolean;
};

type Assessment = {
  id: number;
  title: string;
  description: string;
  durationMinutes: number;
  passScore: number;
  competencyId: number;
  competencyName: string;
  source: string;
  questions: Question[];
};

type Audience = { id: number; name: string };

function QuestionEditor({
  assessmentId,
  question,
  index,
  entranceMode,
}: {
  assessmentId: number;
  question: Question;
  index: number;
  entranceMode: boolean;
}) {
  const { t } = useI18n();
  const [type, setType] = useState<"single" | "multiple" | "text">(
    question.type,
  );
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
          <button type="submit" className="btn btn-ghost">
            {t("delete_question")}
          </button>
        </form>
      </div>

      <form action={updateQuestionAction} className="stack-form">
        <input type="hidden" name="questionId" value={question.id} />
        <input type="hidden" name="assessmentId" value={assessmentId} />

        <label>
          {t("question_prompt")}
          <textarea
            name="prompt"
            required
            rows={3}
            defaultValue={question.prompt}
          />
        </label>

        <div className="layout-2" style={{ gap: 12 }}>
          <label>
            {t("section_name")}
            <input name="section" required defaultValue={question.section} />
          </label>
          {entranceMode ? (
            <label>
              Категория входного теста
              <select name="difficulty" defaultValue={question.difficulty}>
                <option value="basic">Базовый вопрос</option>
                <option value="situation">Рабочая ситуация</option>
                <option value="advanced">Сложный вопрос</option>
              </select>
            </label>
          ) : (
            <label>
              {t("section_kind")}
              <select
                name="knowledgeKind"
                defaultValue={
                  question.knowledgeKind === "aspiration"
                    ? "aspiration"
                    : "knowledge"
                }
              >
                <option value="knowledge">{t("kind_knowledge")}</option>
                <option value="aspiration">{t("kind_aspiration")}</option>
              </select>
            </label>
          )}
        </div>
        {entranceMode ? (
          <input type="hidden" name="knowledgeKind" value="knowledge" />
        ) : (
          <input type="hidden" name="difficulty" value={question.difficulty} />
        )}

        <div className="layout-2" style={{ gap: 12 }}>
          <label>
            {t("question_type")}
            <select
              name="type"
              value={type}
              onChange={(e) =>
                setType(e.target.value as "single" | "multiple" | "text")
              }
            >
              <option value="single">{t("q_type_single")}</option>
              <option value="multiple">{t("q_type_multiple")}</option>
              <option value="text">{t("q_type_text")}</option>
            </select>
          </label>
          <label>
            {t("weight")}
            <input
              name="weight"
              type="number"
              min={0}
              defaultValue={question.weight}
            />
          </label>
        </div>

        {type === "text" ? (
          <label>
            {t("keywords")}
            <input
              name="keywords"
              defaultValue={question.keywords.join(", ")}
            />
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

        <label className="cand-check">
          <input
            type="checkbox"
            name="isActive"
            value="1"
            defaultChecked={question.isActive}
          />
          Вопрос активен
        </label>

        <button type="submit" className="btn btn-primary">
          {t("save_question")}
        </button>
      </form>
    </article>
  );
}

export function AssessmentEditorView({
  assessment,
  audiences,
  backHref = "/assessments",
  shellPathname = "/assessments",
}: {
  assessment: Assessment;
  audiences: Audience[];
  backHref?: string;
  shellPathname?: string;
}) {
  const { t } = useI18n();
  const entranceCounts =
    assessment.source === "candidate"
      ? assessment.questions.reduce(
          (counts, question) => {
            if (question.isActive) {
              counts[entranceSection(question.difficulty)] += 1;
            }
            return counts;
          },
          { basic: 0, situation: 0, advanced: 0 },
        )
      : null;

  return (
    <AppShell pathname={shellPathname}>
      <PageHeader
        title={assessment.title}
        subtitle={`${assessment.questions.length} ${t("questions")}`}
      />

      <p style={{ marginBottom: 14 }}>
        <Link href={backHref} className="btn btn-ghost">
          ← {t("to_tests")}
        </Link>
      </p>

      <article className="panel" style={{ marginBottom: 18, maxWidth: 960 }}>
        <h2>{t("edit_test_meta")}</h2>
        <form action={updateAssessmentAction} className="stack-form">
          <input type="hidden" name="assessmentId" value={assessment.id} />
          <label>
            {t("test_title")}
            <input name="title" required defaultValue={assessment.title} />
          </label>
          <label>
            {t("test_description")}
            <textarea
              name="description"
              rows={2}
              defaultValue={assessment.description}
            />
          </label>
          <div className="layout-2" style={{ gap: 12 }}>
            <label>
              {t("col_audience")}
              <select
                name="competencyId"
                required
                defaultValue={assessment.competencyId}
              >
                {audiences.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("duration_min")}
              <input
                name="durationMinutes"
                type="number"
                min={5}
                max={assessment.source === "candidate" ? 25 : undefined}
                defaultValue={assessment.durationMinutes}
              />
            </label>
          </div>
          {assessment.source === "candidate" ? (
            <label>
              Проходной порог, %
              <input
                name="passScore"
                type="number"
                min={0}
                max={100}
                defaultValue={assessment.passScore}
              />
            </label>
          ) : (
            <input type="hidden" name="passScore" value={assessment.passScore} />
          )}
          <button type="submit" className="btn btn-primary">
            {t("save_test")}
          </button>
        </form>
      </article>

      {entranceCounts ? (
        <article className="panel" style={{ marginBottom: 18, maxWidth: 960 }}>
          <h2>Структура входного теста</h2>
          <div className="entrance-result-metrics">
            <span>Базовые: {entranceCounts.basic}/5</span>
            <span>Рабочие ситуации: {entranceCounts.situation}/5</span>
            <span>Сложные: {entranceCounts.advanced}/5</span>
          </div>
          <p className="muted">
            При наличии более пяти вопросов в категории система создаёт разные
            варианты теста. На одну попытку выбирается 15 вопросов.
          </p>
        </article>
      ) : null}

      <section style={{ maxWidth: 960 }}>
        <h2 style={{ marginBottom: 12 }}>
          {t("questions_list")} · {assessment.questions.length}
        </h2>
        {assessment.questions.length === 0 ? (
          <p className="muted">{t("no_questions")}</p>
        ) : (
          assessment.questions.map((q, i) => (
            <QuestionEditor
              key={q.id}
              assessmentId={assessment.id}
              question={q}
              index={i}
              entranceMode={assessment.source === "candidate"}
            />
          ))
        )}
      </section>

      {assessment.source === "candidate" ? (
        <article className="panel" style={{ marginTop: 18, maxWidth: 960 }}>
          <h2>Добавить вопрос</h2>
          <p className="muted">
            Для входного теста подготовьте 5 базовых вопросов, 5 рабочих
            ситуаций и 5 сложных вопросов. Кандидату показываются четыре
            варианта без ключа ответов.
          </p>
          <form action={addQuestionAction} className="stack-form">
            <input type="hidden" name="assessmentId" value={assessment.id} />
            <input type="hidden" name="type" value="single" />
            <input type="hidden" name="knowledgeKind" value="knowledge" />
            <input type="hidden" name="weight" value="1" />
            <input type="hidden" name="isActive" value="1" />
            <label>
              Вопрос
              <textarea name="prompt" rows={3} required />
            </label>
            <div className="layout-2" style={{ gap: 12 }}>
              <label>
                Компетенция / тема
                <input name="section" required placeholder="Например: Excel" />
              </label>
              <label>
                Категория
                <select name="difficulty" defaultValue="basic">
                  <option value="basic">Базовый вопрос</option>
                  <option value="situation">Рабочая ситуация</option>
                  <option value="advanced">Сложный вопрос</option>
                </select>
              </label>
            </div>
            <div className="options-editor">
              <strong>Варианты ответа</strong>
              {[0, 1, 2, 3].map((optionIndex) => (
                <div key={optionIndex} className="option-row">
                  <label className="option-correct">
                    <input
                      type="radio"
                      name="correctIndex"
                      value={optionIndex}
                      required
                    />
                    <span>{t("correct_mark")}</span>
                  </label>
                  <input
                    name="option"
                    required
                    placeholder={`${t("option")} ${optionIndex + 1}`}
                  />
                </div>
              ))}
            </div>
            <button type="submit" className="btn btn-primary">
              Добавить вопрос
            </button>
          </form>
        </article>
      ) : null}
    </AppShell>
  );
}
