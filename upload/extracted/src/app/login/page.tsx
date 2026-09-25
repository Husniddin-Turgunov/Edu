import { LoginView } from "@/components/LoginView";
import { getSettingsSection } from "@/db/system-settings";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const { error, reset } = await searchParams;
  const security = await getSettingsSection("security").catch(() => ({
    consentRequired: false,
  }));
  return (
    <LoginView
      error={error}
      reset={reset === "1"}
      consentRequired={Boolean(security.consentRequired)}
    />
  );
}
