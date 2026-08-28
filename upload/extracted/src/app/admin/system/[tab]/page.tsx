import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AccessView } from "@/components/AccessView";
import { IntegrationsHubView } from "@/components/IntegrationsHubView";
import { SettingsAuditView } from "@/components/SettingsAuditView";
import { SettingsSectionView } from "@/components/SettingsSectionView";
import { SystemGuidePanel, SystemOverviewClient } from "@/components/SystemPanels";
import { SystemWorkspace } from "@/components/SystemWorkspace";
import type { SystemStatusCard, SystemStatusTone } from "@/components/SystemOverviewView";
import { getIntegrationsOverview } from "@/db/integrations";
import {
  getAllPlatformUsers,
  getCandidates,
  getEmployees,
  ensureDb,
} from "@/db/queries";
import {
  getSettingsSection,
  listAuditLogs,
} from "@/db/system-settings";
import { getTerminalQueuesOverview } from "@/db/terminal";
import { getSession } from "@/lib/auth";
import { isSystemTab, type SystemTabId } from "@/lib/admin-system-hub";
import { verifyLocalStorageAccess } from "@/lib/local-storage";

export const dynamic = "force-dynamic";

function toneFromConfigured(configured: boolean, partial = false): SystemStatusTone {
  if (configured) return "ok";
  if (partial) return "warn";
  return "unset";
}

async function buildOverviewCards(): Promise<{
  cards: SystemStatusCard[];
  meta: {
    lastSync: string;
    errorCount: number;
    storageLabel: string;
    lastBackup: string;
  };
}> {
  const overview = await getIntegrationsOverview();
  const storage = await verifyLocalStorageAccess().catch(() => ({
    ok: false as const,
    message: "unavailable",
  }));
  const bySystem = Object.fromEntries(
    overview.items.map((item) => [item.system, item.configured]),
  );

  const cards: SystemStatusCard[] = [
    {
      id: "platform",
      titleKey: "sys_comp_platform",
      tone: "ok",
      detail: "online",
      href: "/admin/system/health",
    },
    {
      id: "db",
      titleKey: "sys_comp_db",
      tone: "ok",
      detail: "SQLite / Turso",
      href: "/admin/system/health",
    },
    {
      id: "telegram",
      titleKey: "sys_comp_telegram",
      tone: toneFromConfigured(Boolean(bySystem.telegram)),
      detail: bySystem.telegram ? "ok" : "—",
      href: "/integrations/telegram",
    },
    {
      id: "verifix",
      titleKey: "sys_comp_verifix",
      tone: toneFromConfigured(Boolean(bySystem.verifix)),
      detail: bySystem.verifix ? "ok" : "—",
      href: "/integrations/verifix",
    },
    {
      id: "bitrix",
      titleKey: "sys_comp_bitrix",
      tone: toneFromConfigured(Boolean(bySystem.bitrix)),
      detail: bySystem.bitrix ? "ok" : "—",
      href: "/integrations/bitrix",
    },
    {
      id: "drive",
      titleKey: "sys_comp_drive",
      tone: toneFromConfigured(overview.env.drive),
      detail: overview.env.drive ? "ok" : "—",
      href: "/integrations/storage",
    },
    {
      id: "smtp",
      titleKey: "sys_comp_smtp",
      tone: toneFromConfigured(Boolean(bySystem.smtp)),
      detail: bySystem.smtp ? "ok" : "—",
      href: "/integrations/smtp",
    },
    {
      id: "openai",
      titleKey: "sys_comp_openai",
      tone: process.env.OPENAI_API_KEY ? "ok" : "unset",
      detail: process.env.OPENAI_API_KEY ? "ok" : "—",
      href: "/admin/system/integrations",
    },
  ];

  const errorCount = 0;
  return {
    cards,
    meta: {
      lastSync: new Date().toISOString().slice(0, 16).replace("T", " "),
      errorCount,
      storageLabel: storage.ok ? "local OK" : "check",
      lastBackup: "—",
    },
  };
}

export default async function AdminSystemTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");
  const { tab: raw } = await params;
  if (!isSystemTab(raw)) notFound();
  const tab = raw as SystemTabId;
  await ensureDb();

  if (tab === "overview") {
    const data = await buildOverviewCards();
    return (
      <SystemWorkspace tab={tab}>
        <SystemOverviewClient cards={data.cards} meta={data.meta} />
      </SystemWorkspace>
    );
  }

  if (tab === "company" || tab === "notifications" || tab === "security") {
    const section =
      tab === "company"
        ? "company"
        : tab === "notifications"
          ? "notifications"
          : "security";
    const config = await getSettingsSection(section);
    return (
      <SystemWorkspace tab={tab}>
        <SettingsSectionView
          section={section}
          config={config as unknown as Record<string, unknown>}
          embedded
        />
      </SystemWorkspace>
    );
  }

  if (tab === "roles") {
    const config = await getSettingsSection("permissions");
    return (
      <SystemWorkspace tab={tab}>
        <SettingsSectionView
          section="permissions"
          config={config as unknown as Record<string, unknown>}
          embedded
        />
      </SystemWorkspace>
    );
  }

  if (tab === "processes") {
    const [tests, learning] = await Promise.all([
      getSettingsSection("tests"),
      getSettingsSection("learning"),
    ]);
    return (
      <SystemWorkspace tab={tab}>
        <div className="stack" style={{ gap: 18 }}>
          <SettingsSectionView
            section="tests"
            config={tests as unknown as Record<string, unknown>}
            embedded
          />
          <SettingsSectionView
            section="learning"
            config={learning as unknown as Record<string, unknown>}
            embedded
          />
        </div>
      </SystemWorkspace>
    );
  }

  if (tab === "users") {
    const [users, candidates, employees, terminalQueues] = await Promise.all([
      getAllPlatformUsers(),
      getCandidates(),
      getEmployees(),
      getTerminalQueuesOverview(),
    ]);
    const hdrs = await headers();
    const host =
      hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
    const proto = hdrs.get("x-forwarded-proto") ?? "https";
    const entryUrl = `${proto}://${host}/login`;
    return (
      <SystemWorkspace tab={tab}>
        <AccessView
          embedded
          entryUrl={entryUrl}
          users={[
            ...users,
            ...[1, 2, 3, 4, 5].map((slotNumber) => {
              const active = terminalQueues[slotNumber]?.active;
              return {
                id: -slotNumber,
                login: `/terminal/${slotNumber}`,
                displayName: `Аккаунт ваканта ${slotNumber}`,
                role: "terminal",
                participantKind: "candidate",
                isActive: true,
                slotNumber,
                terminalStatus: active?.status ?? "free",
                currentCandidate: active?.candidateName ?? null,
              };
            }),
          ]}
          candidates={candidates.map((c) => ({
            id: c.id,
            name: c.name,
            subtitle: c.roleTitle,
          }))}
          employees={employees.map((e) => ({
            id: e.id,
            name: e.name,
            subtitle: `${e.roleTitle} · ${e.department}`,
          }))}
        />
      </SystemWorkspace>
    );
  }

  if (tab === "integrations") {
    const overview = await getIntegrationsOverview();
    const statuses: Record<string, boolean> = {
      drive: overview.env.drive,
      sheets: overview.env.sheets,
    };
    for (const item of overview.items) {
      statuses[item.system] = item.configured;
    }
    return (
      <SystemWorkspace tab={tab}>
        <IntegrationsHubView statuses={statuses} embedded />
      </SystemWorkspace>
    );
  }

  if (tab === "design") {
    return (
      <SystemWorkspace tab={tab}>
        <SystemGuidePanel
          titleKey="sys_tab_design"
          noteKey="sys_guide_design"
          actions={[
            { href: "/design", labelKey: "sys_open_design" },
            { href: "/?customize=1", labelKey: "admin_desk_customize" },
          ]}
        />
      </SystemWorkspace>
    );
  }

  if (tab === "storage") {
    return (
      <SystemWorkspace tab={tab}>
        <SystemGuidePanel
          titleKey="sys_tab_storage"
          noteKey="sys_guide_storage"
          actions={[
            { href: "/integrations/storage", labelKey: "sys_open_storage" },
            { href: "/admin/system/sync", labelKey: "sys_tab_sync" },
          ]}
        />
      </SystemWorkspace>
    );
  }

  if (tab === "sync") {
    return (
      <SystemWorkspace tab={tab}>
        <SystemGuidePanel
          titleKey="sys_tab_sync"
          noteKey="sys_guide_sync"
          actions={[
            { href: "/integrations/log", labelKey: "sys_open_sync_log" },
            { href: "/admin/system/integrations", labelKey: "sys_tab_integrations" },
          ]}
        />
      </SystemWorkspace>
    );
  }

  if (tab === "audit") {
    const logs = await listAuditLogs(80);
    return (
      <SystemWorkspace tab={tab}>
        <SettingsAuditView logs={logs} embedded />
      </SystemWorkspace>
    );
  }

  if (tab === "health") {
    const data = await buildOverviewCards();
    return (
      <SystemWorkspace tab={tab}>
        <SystemOverviewClient cards={data.cards} meta={data.meta} />
      </SystemWorkspace>
    );
  }

  if (tab === "backups") {
    return (
      <SystemWorkspace tab={tab}>
        <SystemGuidePanel
          titleKey="sys_tab_backups"
          noteKey="sys_guide_backups"
          actions={[
            { href: "/admin/system/security", labelKey: "sys_tab_security" },
            { href: "/admin/system/storage", labelKey: "sys_tab_storage" },
          ]}
        />
      </SystemWorkspace>
    );
  }

  notFound();
}
