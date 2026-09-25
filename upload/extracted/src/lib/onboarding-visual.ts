import type { Locale } from "@/lib/i18n";
import type { ParticipantKind, UserRole } from "@/lib/auth-core";
import {
  emptyRoleHomeDocument,
  documentVisibleToUser,
  type PermanentViewAudience,
  type RoleHomeDocument,
} from "@/lib/role-home";

/** One-time mandatory onboarding wizard steps (order = step index). */
export const INTERN_ONBOARDING_SECTIONS = [
  "welcome",
  "history",
  "about",
  "structure",
  "rules",
] as const;

export type InternOnboardingSection =
  (typeof INTERN_ONBOARDING_SECTIONS)[number];

/** Permanent home canvas shown after onboarding is completed. */
export const INTERN_PERMANENT_SECTION = "permanent" as const;

/** All editable intern company/home canvases in the design editor. */
export const INTERN_EDITOR_SECTIONS = [
  INTERN_PERMANENT_SECTION,
  ...INTERN_ONBOARDING_SECTIONS,
] as const;

export type InternEditorSection = (typeof INTERN_EDITOR_SECTIONS)[number];

export const VISUAL_LOCALES = ["ru", "uz", "en"] as const;

export type OnboardingVisualPageKey =
  `intern-onboarding-${InternEditorSection}-${Locale}`;

export function onboardingVisualPageKey(
  section: InternEditorSection,
  locale: Locale,
): OnboardingVisualPageKey {
  return `intern-onboarding-${section}-${locale}`;
}

export function isOnboardingVisualPageKey(
  value: string,
): value is OnboardingVisualPageKey {
  return INTERN_EDITOR_SECTIONS.some((section) =>
    VISUAL_LOCALES.some(
      (locale) => value === onboardingVisualPageKey(section, locale),
    ),
  );
}

export function onboardingSectionForStep(
  step: number,
): InternOnboardingSection {
  return INTERN_ONBOARDING_SECTIONS[
    Math.max(0, Math.min(INTERN_ONBOARDING_SECTIONS.length - 1, step))
  ];
}

export function emptyOnboardingVisualPages(): Record<
  OnboardingVisualPageKey,
  RoleHomeDocument
> {
  return Object.fromEntries(
    INTERN_EDITOR_SECTIONS.flatMap((section) =>
      VISUAL_LOCALES.map((locale) => [
        onboardingVisualPageKey(section, locale),
        emptyRoleHomeDocument(),
      ]),
    ),
  ) as Record<OnboardingVisualPageKey, RoleHomeDocument>;
}

export function visualAudienceForSession(input: {
  role: UserRole;
  participantKind?: ParticipantKind | null;
}): PermanentViewAudience | null {
  if (input.role === "admin") return "admin";
  if (input.role === "observer") return "observer";
  if (input.role === "manager") return "manager";
  if (input.role === "participant") {
    if (input.participantKind === "employee") return "employee";
    if (input.participantKind === "intern") return "intern";
  }
  return null;
}

export function preferredLocaleFromUser(
  preferredLocale: string | null | undefined,
): Locale {
  return preferredLocale === "uz" || preferredLocale === "en"
    ? preferredLocale
    : "ru";
}

export function onboardingStepsForAudience(
  pages:
    | Record<OnboardingVisualPageKey, RoleHomeDocument>
    | Partial<Record<OnboardingVisualPageKey, RoleHomeDocument>>,
  locale: Locale,
  audience: PermanentViewAudience,
  userId?: number,
): number[] {
  return INTERN_ONBOARDING_SECTIONS.flatMap((section, index) => {
    const page = pages[onboardingVisualPageKey(section, locale)];
    if (!page) return [];
    if (userId != null) {
      return documentVisibleToUser(page, { userId, audience })
        ? [index]
        : [];
    }
    return page.visibleTo.includes(audience) ? [index] : [];
  });
}
