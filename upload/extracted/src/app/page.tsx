import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardView } from "@/components/DashboardView";
import {
  getDashboardStats,
  getPlatformUserById,
  getVisualContentPage,
  userNeedsVisualOnboarding,
} from "@/db/queries";
import { getSession } from "@/lib/auth";
import {
  onboardingVisualPageKey,
  preferredLocaleFromUser,
} from "@/lib/onboarding-visual";
import { DEFAULT_BACKGROUND, documentVisibleToUser } from "@/lib/role-home";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  const [stats, user] = await Promise.all([
    getDashboardStats(),
    session ? getPlatformUserById(session.userId) : Promise.resolve(null),
  ]);

  if (
    session?.role === "admin" &&
    user &&
    (await userNeedsVisualOnboarding({
      userId: session.userId,
      role: session.role,
      participantKind: session.participantKind,
      preferredLocale: user.preferredLocale,
      onboardingCompletedAt: user.onboardingCompletedAt,
      onboardingStep: user.onboardingStep,
    }))
  ) {
    redirect("/my/onboarding");
  }

  const permanentLayout =
    session?.role === "admin"
      ? await getVisualContentPage(
          onboardingVisualPageKey(
            "permanent",
            preferredLocaleFromUser(user?.preferredLocale),
          ),
        )
      : null;
  const showPermanent =
    permanentLayout &&
    session &&
    documentVisibleToUser(permanentLayout, {
      userId: session.userId,
      audience: "admin",
    }) &&
    (permanentLayout.elements.length > 0 ||
      permanentLayout.background !== DEFAULT_BACKGROUND);
  const personalizedPermanent =
    showPermanent && permanentLayout
      ? {
          ...permanentLayout,
          elements: permanentLayout.elements.map((element) =>
            element.type === "text"
              ? {
                  ...element,
                  content: element.content.replaceAll(
                    "{name}",
                    user?.displayName || session?.name || "",
                  ),
                }
              : element,
          ),
        }
      : null;

  return (
    <Suspense fallback={null}>
      <DashboardView stats={stats} permanentDocument={personalizedPermanent} />
    </Suspense>
  );
}
