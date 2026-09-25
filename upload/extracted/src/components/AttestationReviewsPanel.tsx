"use client";

import Link from "next/link";
import { createAttestationReviewAction } from "@/db/actions";
import { useI18n } from "@/lib/i18n";

type Employee = {
  id: number;
  name: string;
  roleTitle: string;
  department: string;
  currentLevel: string;
  targetLevel: string;
};

type Review = {
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
};

const typeLabels = {
  ru: {
    after_trial: "После 5 дней",
    month_1: "После 1-го месяца",
    month_2: "После 2-го месяца",
    final_3_months: "Финальная после 3 месяцев",
    repeat: "Повторная",
    annual: "Ежегодная",
    transfer: "При переводе",
  },
  uz: {
    after_trial: "5 kundan keyin",
    month_1: "1-oydan keyin",
    month_2: "2-oydan keyin",
    final_3_months: "3 oydan keyingi yakuniy",
    repeat: "Takroriy",
    annual: "Yillik",
    transfer: "O‘tkazishda",
  },
  en: {
    after_trial: "After five days",
    month_1: "After month one",
    month_2: "After month two",
    final_3_months: "Final after three months",
    repeat: "Repeat",
    annual: "Annual",
    transfer: "On transfer",
  },
} as const;

export function AttestationReviewsPanel({
  attestationId,
  startsAt,
  employees,
  reviews,
}: {
  attestationId: number;
  startsAt: string;
  employees: Employee[];
  reviews: Review[];
}) {
  const { locale } = useI18n();
  const labels = typeLabels[locale];
  const text =
    locale === "uz"
      ? {
          title: "Xodimlar attestatsiyasi",
          note: "Komissiya kartasi, baholar, qaror va PDF bayonnoma.",
          employee: "Xodim",
          type: "Attestatsiya turi",
          date: "Sana",
          commission: "Komissiya",
          hint: "Ismlar vergul yoki yangi qatorda",
          create: "Kartani yaratish",
          empty: "Hali kartalar yo‘q.",
          score: "Yakuniy ball",
        }
      : locale === "en"
        ? {
            title: "Employee attestations",
            note: "Commission card, scores, decision and PDF protocol.",
            employee: "Employee",
            type: "Attestation type",
            date: "Date",
            commission: "Commission",
            hint: "Names separated by commas or new lines",
            create: "Create card",
            empty: "No cards yet.",
            score: "Final score",
          }
        : {
            title: "Аттестации сотрудников",
            note: "Карточка комиссии, оценки, решение и PDF-протокол.",
            employee: "Сотрудник",
            type: "Вид аттестации",
            date: "Дата",
            commission: "Комиссия",
            hint: "Ф.И.О. через запятую или с новой строки",
            create: "Создать карточку",
            empty: "Карточек пока нет.",
            score: "Итоговый балл",
          };

  return (
    <section style={{ maxWidth: 960, marginBottom: 20 }}>
      <article className="panel">
        <h2>{text.title}</h2>
        <p className="muted">{text.note}</p>
        <form action={createAttestationReviewAction} className="stack-form">
          <input type="hidden" name="attestationId" value={attestationId} />
          <div className="layout-2" style={{ gap: 12 }}>
            <label>
              {text.employee}
              <select name="employeeId" required defaultValue="">
                <option value="" disabled>
                  —
                </option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} · {employee.roleTitle} · {employee.currentLevel}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {text.type}
              <select name="type" defaultValue="final_3_months">
                {Object.entries(labels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="layout-2" style={{ gap: 12 }}>
            <label>
              {text.date}
              <input
                type="datetime-local"
                name="scheduledAt"
                defaultValue={startsAt.slice(0, 16)}
              />
            </label>
            <label>
              {text.commission}
              <input name="commission" placeholder={text.hint} />
            </label>
          </div>
          <button className="btn btn-primary" type="submit">
            {text.create}
          </button>
        </form>
      </article>

      <div className="list" style={{ marginTop: 14 }}>
        {reviews.length === 0 ? (
          <p className="muted">{text.empty}</p>
        ) : (
          reviews.map((review) => (
            <Link
              key={review.id}
              href={`/attestation/reviews/${review.id}`}
              className="list-item learn-role-card"
            >
              <span style={{ flex: 1 }}>
                <strong>{review.employeeName}</strong>
                <span className="muted" style={{ display: "block" }}>
                  {review.roleTitle} ·{" "}
                  {labels[review.type as keyof typeof labels] || review.type} ·{" "}
                  {new Date(review.scheduledAt).toLocaleDateString()}
                </span>
              </span>
              <span>
                {review.finalScore != null
                  ? `${text.score}: ${Math.round(review.finalScore)}%`
                  : review.status}
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
