import { notFound, redirect } from "next/navigation";
import { SettingsSectionView } from "@/components/SettingsSectionView";
import {
  getSettingsSection,
  isSettingsSection,
} from "@/db/system-settings";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");
  const { section } = await params;
  if (section === "audit") redirect("/settings/audit");
  if (!isSettingsSection(section)) notFound();
  const config = await getSettingsSection(section);
  return (
    <SettingsSectionView
      section={section}
      config={config as unknown as Record<string, unknown>}
    />
  );
}
