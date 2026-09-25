import { redirect } from "next/navigation";
import { InternOnboardingView } from "@/components/InternOnboardingView";
import {
  getPlatformUserById,
  resolveVisualOnboardingStep,
} from "@/db/queries";
import { getSession, homePathForRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InternOnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await getPlatformUserById(session.userId);
  if (!user) redirect("/login?error=invalid");

  const resolved = await resolveVisualOnboardingStep({
    userId: session.userId,
    role: session.role,
    participantKind: session.participantKind,
    preferredLocale: user.preferredLocale,
    onboardingCompletedAt: user.onboardingCompletedAt,
    onboardingStep: user.onboardingStep,
  });

  if (!resolved) {
    redirect(homePathForRole(session.role, session.participantKind));
  }

  return (
    <InternOnboardingView
      name={user.displayName || session.name}
      step={resolved.step}
      progressIndex={resolved.progressIndex}
      totalSteps={resolved.total}
      themeHue={user.avatarHue ?? 220}
      document={resolved.document}
    />
  );
}
