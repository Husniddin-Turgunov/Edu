"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell, LevelBadge, PageHeader } from "@/components/ui";
import { saveAttestationReviewAction } from "@/db/actions";
import { useI18n } from "@/lib/i18n";

type ScoreKey =
  | "practicalScore"
  | "projectScore"
  | "defenseScore"
  | "independenceScore"
  | "disciplineScore"
  | "mentorScore"
  | "managerScore";

type ReviewDetail = {
  review: {
    id: number;
    attestationId: number;
    type: string;
    status: string;
    scheduledAt: string;
    commission: string[];
    signatures: string[];
    testScore: number | null;
    practicalScore: number | null;
    projectScore: number | null;
    defenseScore: number | null;
    independenceScore: number | null;
    disciplineScore: number | null;
    mentorScore: number | null;
    managerScore: number | null;
    finalScore: number | null;
    weakCompetencies: string[];
    mentorComment: string;
    managerComment: string;
    commissionComment: string;
    decision: string;
    nextCheckAt: string | null;
    protocolNumber: string | null;
    completedAt: string | null;
  };
  employee: {
    id: number;
    name: string;
    roleTitle: string;
    department: string;
    currentLevel: string;
    targetLevel: string;
  };
  attestation: { id: number; title: string; passingScore: number };
  assessmentTitle: string | null;
  latestResult: {
    score: number;
    levelCode: string;
    completedAt: string;
  } | null;
  matrixSummary: { checked: number; weak: number };
};

const scoreFields: Array<[ScoreKey, string, string, string]> = [
  ["practicalScore", "Практическая задача", "Amaliy vazifa", "Practical task"],
  ["projectScore", "Рабочий проект", "Ish loyihasi", "Work project"],
  ["defenseScore", "Защита", "Himoya", "Defense"],
  ["independenceScore", "Самостоятельность", "Mustaqillik", "Independence"],
  ["disciplineScore", "Дисциплина", "Intizom", "Discipline"],
  ["mentorScore", "Оценка наставника", "Ustoz bahosi", "Mentor evaluation"],
  ["managerScore", "Оценка руководителя", "Rahbar bahosi", "Manager evaluation"],
];

const types = [
  ["after_trial", "После 5 дней", "5 kundan keyin", "After five days"],
  ["month_1", "После 1-го месяца", "1-oydan keyin", "After month one"],
  ["month_2", "После 2-го месяца", "2-oydan keyin", "After month two"],
  ["final_3_months", "Финальная после 3 месяцев", "3 oydan keyingi yakuniy", "Final after three months"],
  ["repeat", "Повторная", "Takroriy", "Repeat"],
  ["annual", "Ежегодная", "Yillik", "Annual"],
  ["transfer", "При переводе", "O‘tkazishda", "On transfer"],
] as const;

const decisions = [
  ["middle_confirmed", "Middle подтверждён", "Middle tasdiqlandi", "Middle confirmed"],
  ["middle_not_confirmed", "Middle не подтверждён", "Middle tasdiqlanmadi", "Middle not confirmed"],
  ["keep_junior", "Оставить Junior", "Junior darajasida qoldirish", "Keep Junior"],
  ["additional_learning", "Дополнительное обучение", "Qo‘shimcha ta’lim", "Additional learning"],
  ["repeat", "Повторить аттестацию", "Attestatsiyani takrorlash", "Repeat attestation"],
  ["transfer", "Перевести на другую должность", "Boshqa lavozimga o‘tkazish", "Transfer role"],
] as const;

function localDate(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

export function AttestationReviewView({ detail }: { detail: ReviewDetail }) {
  const { locale } = useI18n();
  const lang = locale === "uz" ? 2 : locale === "en" ? 3 : 1;
  const [scores, setScores] = useState<Record<ScoreKey, string>>(
    Object.fromEntries(
      scoreFields.map(([key]) => [
        key,
        detail.review[key] == null ? "" : String(detail.review[key]),
      ]),
    ) as Record<ScoreKey, string>,
  );
  const finalScore = useMemo(() => {
    const values = [
      detail.review.testScore,
      ...Object.values(scores).map((value) =>
        value.trim() === "" ? null : Number(value),
      ),
    ].filter((value): value is number => value != null && Number.isFinite(value));
    return values.length
      ? Math.round(
          (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
        ) / 10
      : null;
  }, [detail.review.testScore, scores]);
  const text =
    locale === "uz"
      ? {
          back: "Attestatsiyaga qaytish",
          employee: "Xodim kartasi",
          level: "Daraja",
          type: "Attestatsiya turi",
          status: "Holat",
          date: "Sana",
          commission: "Komissiya",
          test: "Test",
          score: "Yakuniy ball",
          weak: "Zaif kompetensiyalar",
          weakHint: "Har birini vergul yoki yangi qatorda yozing",
          comments: "Izohlar",
          mentor: "Ustoz izohi",
          manager: "Rahbar izohi",
          commissionComment: "Komissiya izohi",
          decision: "Qaror",
          next: "Keyingi tekshiruv",
          signatures: "Imzolar",
          signaturesHint: "Imzolagan komissiya a’zolari",
          save: "Kartani saqlash",
          pdf: "PDF bayonnoma",
          protocol: "Bayonnoma",
          matrix: "Kompetensiyalar",
        }
      : locale === "en"
        ? {
            back: "Back to attestation",
            employee: "Employee card",
            level: "Level",
            type: "Attestation type",
            status: "Status",
            date: "Date",
            commission: "Commission",
            test: "Test",
            score: "Final score",
            weak: "Weak competencies",
            weakHint: "Separate items by commas or new lines",
            comments: "Comments",
            mentor: "Mentor comment",
            manager: "Manager comment",
            commissionComment: "Commission comment",
            decision: "Decision",
            next: "Next review",
            signatures: "Signatures",
            signaturesHint: "Commission members who signed",
            save: "Save card",
            pdf: "PDF protocol",
            protocol: "Protocol",
            matrix: "Competencies",
          }
        : {
            back: "Назад к аттестации",
            employee: "Карточка сотрудника",
            level: "Уровень",
            type: "Вид аттестации",
            status: "Статус",
            date: "Дата",
            commission: "Комиссия",
            test: "Тест",
            score: "Итоговый балл",
            weak: "Слабые компетенции",
            weakHint: "Перечислите через запятую или с новой строки",
            comments: "Комментарии",
            mentor: "Комментарий наставника",
            manager: "Комментарий руководителя",
            commissionComment: "Комментарий комиссии",
            decision: "Решение",
            next: "Следующая проверка",
            signatures: "Подписи",
            signaturesHint: "Подписавшие члены комиссии",
            save: "Сохранить карточку",
            pdf: "PDF-протокол",
            protocol: "Протокол",
            matrix: "Компетенции",
          };

  return (
    <AppShell pathname="/attestation">
      <PageHeader
        title={`${text.employee}: ${detail.employee.name}`}
        subtitle={`${detail.employee.roleTitle} · ${detail.employee.department}`}
        action={
          detail.review.protocolNumber ? (
            <a
              href={`/api/attestation-protocol/${detail.review.id}`}
              className="btn btn-primary"
            >
              {text.pdf}
            </a>
          ) : null
        }
      />
      <p style={{ marginBottom: 14 }}>
        <Link
          href={`/attestation/${detail.attestation.id}`}
          className="btn btn-ghost"
        >
          ← {text.back}
        </Link>
      </p>

      <section className="layout-2" style={{ maxWidth: 1040, marginBottom: 18 }}>
        <article className="panel">
          <p className="eyebrow">{text.level}</p>
          <h2 style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <LevelBadge level={detail.employee.currentLevel} />
            <span>→</span>
            <LevelBadge level={detail.employee.targetLevel} />
          </h2>
          <p className="muted">
            {text.matrix}: {detail.matrixSummary.checked} · {text.weak}:{" "}
            {detail.matrixSummary.weak}
          </p>
        </article>
        <article className="panel">
          <p className="eyebrow">{text.score}</p>
          <h2>{finalScore == null ? "—" : `${finalScore}%`}</h2>
          <p className="muted">
            {text.test}:{" "}
            {detail.review.testScore == null
              ? "—"
              : `${Math.round(detail.review.testScore)}%`}
          </p>
          {detail.review.protocolNumber ? (
            <p>
              {text.protocol}: <strong>{detail.review.protocolNumber}</strong>
            </p>
          ) : null}
        </article>
      </section>

      <form
        action={saveAttestationReviewAction}
        className="stack"
        style={{ maxWidth: 1040, gap: 18 }}
      >
        <input type="hidden" name="reviewId" value={detail.review.id} />
        <input
          type="hidden"
          name="attestationId"
          value={detail.attestation.id}
        />
        <article className="panel">
          <div className="layout-2" style={{ gap: 12 }}>
            <label>
              {text.type}
              <select name="type" defaultValue={detail.review.type}>
                {types.map(([value, ru, uz, en]) => (
                  <option key={value} value={value}>
                    {[value, ru, uz, en][lang]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {text.status}
              <select name="status" defaultValue={detail.review.status}>
                <option value="scheduled">scheduled</option>
                <option value="in_progress">in progress</option>
                <option value="awaiting_commission">awaiting commission</option>
                <option value="completed">completed</option>
              </select>
            </label>
            <label>
              {text.date}
              <input
                type="datetime-local"
                name="scheduledAt"
                defaultValue={detail.review.scheduledAt.slice(0, 16)}
              />
            </label>
            <label>
              {text.commission}
              <textarea
                name="commission"
                rows={2}
                defaultValue={detail.review.commission.join("\n")}
              />
            </label>
          </div>
        </article>

        <article className="panel">
          <h2>{text.score}</h2>
          <div className="attestation-score-grid">
            <label>
              {text.test}
              <input
                value={
                  detail.review.testScore == null
                    ? ""
                    : String(detail.review.testScore)
                }
                readOnly
                placeholder="—"
              />
            </label>
            {scoreFields.map(([key, ru, uz, en]) => (
              <label key={key}>
                {[key, ru, uz, en][lang]}
                <input
                  type="number"
                  name={key}
                  min={0}
                  max={100}
                  step="0.1"
                  value={scores[key]}
                  onChange={(event) =>
                    setScores((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>{text.weak}</h2>
          <textarea
            name="weakCompetencies"
            rows={3}
            placeholder={text.weakHint}
            defaultValue={detail.review.weakCompetencies.join("\n")}
          />
        </article>

        <article className="panel">
          <h2>{text.comments}</h2>
          <div className="stack-form">
            <label>
              {text.mentor}
              <textarea
                name="mentorComment"
                rows={3}
                defaultValue={detail.review.mentorComment}
              />
            </label>
            <label>
              {text.manager}
              <textarea
                name="managerComment"
                rows={3}
                defaultValue={detail.review.managerComment}
              />
            </label>
            <label>
              {text.commissionComment}
              <textarea
                name="commissionComment"
                rows={3}
                defaultValue={detail.review.commissionComment}
              />
            </label>
          </div>
        </article>

        <article className="panel">
          <div className="layout-2" style={{ gap: 12 }}>
            <label>
              {text.decision}
              <select name="decision" defaultValue={detail.review.decision}>
                <option value="">—</option>
                {decisions.map(([value, ru, uz, en]) => (
                  <option key={value} value={value}>
                    {[value, ru, uz, en][lang]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {text.next}
              <input
                type="date"
                name="nextCheckAt"
                defaultValue={localDate(detail.review.nextCheckAt)}
              />
            </label>
          </div>
          <label style={{ marginTop: 12 }}>
            {text.signatures}
            <textarea
              name="signatures"
              rows={2}
              placeholder={text.signaturesHint}
              defaultValue={detail.review.signatures.join("\n")}
            />
          </label>
        </article>

        <button type="submit" className="btn btn-primary">
          {text.save}
        </button>
      </form>
    </AppShell>
  );
}
