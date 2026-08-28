import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { ManagerHomeView } from "@/components/ManagerHomeView";
import { DeferredCanvas } from "@/components/DeferredCanvas";
import { getManagerHomeDashboard } from "@/db/manager-cabinet";
import {
  getPlatformUserById,
  getRoleHomePage,
  getVisualContentPage,
  userNeedsVisualOnboarding,
} from "@/db/queries";
import { getSession } from "@/lib/auth";
import { DEFAULT_BACKGROUND, documentVisibleToUser } from "@/lib/role-home";
import {
  onboardingVisualPageKey,
  preferredLocaleFromUser,
} from "@/lib/onboarding-visual";

export const dynamic = "force-dynamic";

export default async function ObserverHomePage() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "observer" && session.role !== "manager")
  ) {
    redirect("/login");
  }

  const audience = session.role === "manager" ? "manager" : "observer";
  const [user, layout] = await Promise.all([
    getPlatformUserById(session.userId),
    getRoleHomePage(audience),
  ]);

  if (
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

  if (session.role === "manager") {
    const dashboard = await getManagerHomeDashboard(session.userId);
    if (!dashboard) redirect("/login");
    return (
      <AppShell
        pathname="/observer/home"
        role="manager"
        themeHue={user?.avatarHue ?? 220}
      >
        <ManagerHomeView data={dashboard} />
      </AppShell>
    );
  }

  const showCanvas =
    layout.elements.length > 0 ||
    (layout.background && layout.background !== DEFAULT_BACKGROUND);
  const permanentLayout = await getVisualContentPage(
    onboardingVisualPageKey(
      "permanent",
      preferredLocaleFromUser(user?.preferredLocale),
    ),
  );
  const showPermanent =
    documentVisibleToUser(permanentLayout, {
      userId: session.userId,
      audience,
    }) &&
    (permanentLayout.elements.length > 0 ||
      permanentLayout.background !== DEFAULT_BACKGROUND);
  const personalizedPermanent = {
    ...permanentLayout,
    elements: permanentLayout.elements.map((element) =>
      element.type === "text"
        ? {
            ...element,
            content: element.content.replaceAll(
              "{name}",
              user?.displayName || session.name,
            ),
          }
        : element,
    ),
  };

  return (
    <AppShell pathname="/observer/home" role="observer" themeHue={user?.avatarHue ?? 220}>
      {showPermanent ? (
        <DeferredCanvas
          document={personalizedPermanent}
          className="role-home-live intern-permanent-welcome"
        />
      ) : null}
      {showCanvas ? (
        <DeferredCanvas document={layout} className="role-home-live" />
      ) : !showPermanent ? (
        <div aria-label="Главное меню" />
      ) : null}
    </AppShell>
  );
}
