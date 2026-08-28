"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n, type MessageKey } from "@/lib/i18n";

const CREATE_ITEMS: { href: string; labelKey: MessageKey }[] = [
  { href: "/candidates", labelKey: "admin_create_candidate" },
  { href: "/interviews", labelKey: "admin_create_interview" },
  { href: "/assessments/kind/candidate", labelKey: "admin_create_test" },
  { href: "/trial", labelKey: "admin_create_internship" },
  { href: "/employees", labelKey: "admin_create_employee" },
  { href: "/learning?focus=programs", labelKey: "admin_create_program" },
  { href: "/attestation", labelKey: "admin_create_attestation" },
  { href: "/learning?focus=lessons", labelKey: "admin_create_lesson" },
  { href: "/competencies", labelKey: "admin_create_role" },
  { href: "/access", labelKey: "admin_create_user" },
];

export function AdminWorkspaceBar({ deskMode = false }: { deskMode?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="admin-workspace-bar">
      <form className="admin-workspace-search" onSubmit={submitSearch}>
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("admin_search_global_ph")}
          aria-label={t("admin_search_global_ph")}
        />
      </form>

      <div className="admin-workspace-actions">
        <div className="admin-create-wrap">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreateOpen((open) => !open)}
            aria-expanded={createOpen}
          >
            {t("admin_create_btn")}
          </button>
          {createOpen ? (
            <div className="admin-create-menu" role="menu">
              {CREATE_ITEMS.map((item) => (
                <Link
                  key={item.labelKey}
                  href={item.href}
                  className="admin-create-item"
                  role="menuitem"
                  onClick={() => setCreateOpen(false)}
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <Link href="/settings/notifications" className="btn btn-ghost">
          {t("admin_notifications_btn")}
        </Link>
        <Link href="/admin/profile" className="btn btn-ghost">
          {t("admin_profile_btn")}
        </Link>
        {deskMode ? (
          <Link href="/?customize=1" className="btn btn-amber">
            {t("admin_desk_customize")}
          </Link>
        ) : (
          <Link href="/admin/system" className="btn btn-ghost">
            {t("admin_settings_btn")}
          </Link>
        )}
      </div>
    </div>
  );
}
