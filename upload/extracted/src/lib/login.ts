import { autoAssignCandidateTest, authenticatePlatformUser } from "@/db/queries";
import { setPreferredLocale } from "@/db/queries";
import { homePathForRole, setSession, type SessionUser } from "@/lib/auth";

export type LoginError = "missing" | "consent" | "invalid" | "server";

export async function completeLogin(formData: FormData): Promise<
  | { ok: true; user: SessionUser; nextPath: string }
  | { ok: false; error: LoginError }
> {
  try {
    const login = String(formData.get("login") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const localeRaw = String(formData.get("locale") ?? "ru");
    const locale =
      localeRaw === "uz" || localeRaw === "en" ? localeRaw : "ru";

    if (!login || !password) return { ok: false, error: "missing" };

    const { getSettingsSection, writeAuditLog } = await import(
      "@/db/system-settings"
    );
    const security = await getSettingsSection("security");
    if (security.consentRequired && formData.get("consent") !== "1") {
      return { ok: false, error: "consent" };
    }

    const user = await authenticatePlatformUser(login, password);
    if (!user) {
      await writeAuditLog({
        actorName: login,
        action: "login",
        target: login,
        result: "error",
        detail: "invalid credentials",
      });
      return { ok: false, error: "invalid" };
    }

    if (user.role === "participant" && user.candidateId) {
      await autoAssignCandidateTest(user.candidateId);
    }

    await writeAuditLog({
      actorUserId: user.userId,
      actorName: user.name,
      action: "login",
      target: login,
      result: "ok",
    });
    await setPreferredLocale(user.userId, locale);
    await setSession(user);
    return {
      ok: true,
      user,
      nextPath: homePathForRole(user.role, user.participantKind),
    };
  } catch (err) {
    console.error("login failed", err);
    return { ok: false, error: "server" };
  }
}
