"use client";

import { ParticipantShell } from "@/components/ParticipantShell";
import { RoleHomeCanvas } from "@/components/visual-editor/RoleHomeCanvas";
import { advanceInternOnboardingAction } from "@/db/actions";
import { useI18n, type MessageKey } from "@/lib/i18n";
import {
  DEFAULT_BACKGROUND,
  type RoleHomeDocument,
} from "@/lib/role-home";

const STEPS: {
  titleKey: MessageKey;
  bodyKey: MessageKey;
  points: MessageKey[];
}[] = [
  {
    titleKey: "intern_intro_welcome_title",
    bodyKey: "intern_intro_welcome_body",
    points: [
      "intern_intro_welcome_point_1",
      "intern_intro_welcome_point_2",
      "intern_intro_welcome_point_3",
    ],
  },
  {
    titleKey: "intern_intro_history_title",
    bodyKey: "intern_intro_history_body",
    points: [
      "intern_intro_history_point_1",
      "intern_intro_history_point_2",
      "intern_intro_history_point_3",
    ],
  },
  {
    titleKey: "intern_intro_about_title",
    bodyKey: "intern_intro_about_body",
    points: [
      "intern_intro_about_point_1",
      "intern_intro_about_point_2",
      "intern_intro_about_point_3",
    ],
  },
  {
    titleKey: "intern_intro_structure_title",
    bodyKey: "intern_intro_structure_body",
    points: [
      "intern_intro_structure_point_1",
      "intern_intro_structure_point_2",
      "intern_intro_structure_point_3",
    ],
  },
  {
    titleKey: "intern_intro_rules_title",
    bodyKey: "intern_intro_rules_body",
    points: [
      "intern_intro_rules_point_1",
      "intern_intro_rules_point_2",
      "intern_intro_rules_point_3",
      "intern_intro_rules_point_4",
    ],
  },
];

export function InternOnboardingView({
  name,
  step,
  progressIndex,
  totalSteps,
  themeHue,
  document,
}: {
  name: string;
  step: number;
  progressIndex: number;
  totalSteps: number;
  themeHue: number;
  document: RoleHomeDocument;
}) {
  const { t } = useI18n();
  const safeStep = Math.max(0, Math.min(STEPS.length - 1, step));
  const current = STEPS[safeStep];
  const safeProgress = Math.max(0, Math.min(totalSteps - 1, progressIndex));
  const isLast = safeProgress >= totalSteps - 1;
  const hasCustomDesign =
    document.elements.length > 0 ||
    document.background !== DEFAULT_BACKGROUND;
  const personalizedDocument = {
    ...document,
    elements: document.elements.map((element) =>
      element.type === "text"
        ? { ...element, content: element.content.replaceAll("{name}", name) }
        : element,
    ),
  };

  return (
    <ParticipantShell themeHue={themeHue} showProfileNav={false}>
      <section className="intern-onboarding">
        <div className="intern-onboarding-progress" aria-label={t("intern_intro_progress")}>
          {Array.from({ length: totalSteps }, (_, index) => (
            <span
              key={index}
              className={
                index < safeProgress
                  ? "done"
                  : index === safeProgress
                    ? "active"
                    : ""
              }
            />
          ))}
        </div>

        <article className="panel intern-onboarding-card">
          <div className="muted">
            {t("intern_intro_step")
              .replace("{current}", String(safeProgress + 1))
              .replace("{total}", String(totalSteps))}
          </div>
          {hasCustomDesign ? (
            <RoleHomeCanvas
              document={personalizedDocument}
              className="role-home-live intern-onboarding-canvas"
            />
          ) : (
            <>
              <h1>
                {safeStep === 0
                  ? t(current.titleKey).replace("{name}", name)
                  : t(current.titleKey)}
              </h1>
              <p className="intern-onboarding-lead">{t(current.bodyKey)}</p>
              <ul className="intern-onboarding-points">
                {current.points.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            </>
          )}

          <form action={advanceInternOnboardingAction}>
            <input type="hidden" name="step" value={safeStep} />
            <button type="submit" className="btn btn-primary">
              {isLast ? t("intern_intro_finish") : t("intern_intro_next")}
            </button>
          </form>
          <p className="muted intern-onboarding-required">
            {t("intern_intro_required")}
          </p>
        </article>
      </section>
    </ParticipantShell>
  );
}
