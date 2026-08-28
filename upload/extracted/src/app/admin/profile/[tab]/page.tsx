import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ProfileOverviewPanel,
  ProfilePreferencesPanel,
  ProfileSecurityPanel,
  ProfileWorkPanel,
} from "@/components/ProfileViews";
import { ProfileWorkspace } from "@/components/ProfileWorkspace";
import { ensureDb, getPlatformUserById } from "@/db/queries";
import { listAuditLogs } from "@/db/system-settings";
import { getSession } from "@/lib/auth";
import {
  isProfileTab,
  parseUiPreferences,
  type ProfileTabId,
} from "@/lib/admin-profile-hub";

export const dynamic = "force-dynamic";

export default async function AdminProfileTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");
  const { tab: raw } = await params;
  if (!isProfileTab(raw)) notFound();
  const tab = raw as ProfileTabId;
  await ensureDb();
  const sp = (await searchParams) ?? {};
  const editing =
    (Array.isArray(sp.edit) ? sp.edit[0] : sp.edit) === "1";

  const user = await getPlatformUserById(session.userId);
  let contact: Record<string, unknown> = {};
  try {
    contact = JSON.parse(user?.uiPreferencesJson || "{}") as Record<
      string,
      unknown
    >;
  } catch {
    contact = {};
  }
  const prefs = parseUiPreferences(user?.uiPreferencesJson);

  if (tab === "overview") {
    return (
      <ProfileWorkspace tab={tab}>
        <ProfileOverviewPanel
          editing={editing}
          user={{
            displayName: user?.displayName || session.name,
            login: user?.login || "",
            role: user?.role || session.role,
            profileJobTitle: user?.profileJobTitle ?? null,
            profileDepartment: user?.profileDepartment ?? null,
            preferredLocale: user?.preferredLocale || "ru",
            avatarData: user?.avatarData ?? null,
            avatarHue: user?.avatarHue ?? 220,
            profileEmail: String(contact.profileEmail ?? ""),
            profilePhone: String(contact.profilePhone ?? ""),
            profileTelegram: String(contact.profileTelegram ?? ""),
          }}
        />
        {!editing ? (
          <section className="panel" style={{ marginTop: 14 }}>
            <div className="profile-facts">
              <div>
                <span className="muted">Логин</span>
                <strong>{user?.login || "—"}</strong>
              </div>
              <div>
                <span className="muted">Язык</span>
                <strong>{user?.preferredLocale || "ru"}</strong>
              </div>
              <div>
                <span className="muted">Часовой пояс</span>
                <strong>{prefs.timezone}</strong>
              </div>
            </div>
          </section>
        ) : null}
      </ProfileWorkspace>
    );
  }

  if (tab === "work") {
    return (
      <ProfileWorkspace tab={tab}>
        <ProfileWorkPanel />
      </ProfileWorkspace>
    );
  }

  if (tab === "preferences") {
    return (
      <ProfileWorkspace tab={tab}>
        <ProfilePreferencesPanel
          prefs={prefs}
          locale={user?.preferredLocale || "ru"}
        />
      </ProfileWorkspace>
    );
  }

  if (tab === "activity") {
    const activity = await listAuditLogs(60);
    const myActivity = activity.filter(
      (row) =>
        row.actorUserId === session.userId ||
        row.actorName === session.name ||
        row.actorName === user?.login,
    );
    return (
      <ProfileWorkspace tab={tab}>
        <section className="panel">
          {myActivity.length === 0 ? (
            <p className="muted">Пока нет записей в журнале.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Действие</th>
                    <th>Объект</th>
                    <th>Результат</th>
                  </tr>
                </thead>
                <tbody>
                  {myActivity.map((row) => (
                    <tr key={row.id}>
                      <td>{row.createdAt}</td>
                      <td>{row.action}</td>
                      <td>{row.target || "—"}</td>
                      <td>{row.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ marginTop: 12 }}>
            <Link href="/admin/system/audit" className="btn btn-ghost">
              Полный журнал действий
            </Link>
          </p>
        </section>
      </ProfileWorkspace>
    );
  }

  if (tab === "security") {
    return (
      <ProfileWorkspace tab={tab}>
        <ProfileSecurityPanel />
      </ProfileWorkspace>
    );
  }

  notFound();
}
