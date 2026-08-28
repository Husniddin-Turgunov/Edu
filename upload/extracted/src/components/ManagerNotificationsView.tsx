"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/db/actions";
import { useI18n } from "@/lib/i18n";

type Item = {
  id: number;
  type: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  readAt: string | null;
};

export function ManagerNotificationsView({
  items,
  unread,
}: {
  items: Item[];
  unread: number;
}) {
  const { t } = useI18n();

  return (
    <>
      <PageHeader
        title={t("mgr_notif_title")}
        subtitle={t("mgr_notif_note")}
        action={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className="btn btn-ghost">
                {t("eh_notif_mark_all")}
              </button>
            </form>
          ) : undefined
        }
      />

      {unread > 0 ? (
        <p className="muted">
          {t("mgr_notif_unread").replace("{count}", String(unread))}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="muted">{t("mgr_notif_empty")}</p>
      ) : (
        <div className="list">
          {items.map((item) => {
            const content = (
              <div className={`list-item notif-item ${item.readAt ? "" : "notif-unread"}`}>
                <div>
                  <strong>{item.title}</strong>
                  {item.body ? <p>{item.body}</p> : null}
                  <div className="muted">{item.createdAt.slice(0, 16)}</div>
                </div>
                {!item.readAt ? (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={item.id} />
                    <button type="submit" className="btn btn-ghost">
                      {t("notifications_mark_read")}
                    </button>
                  </form>
                ) : null}
              </div>
            );
            return item.href ? (
              <Link key={item.id} href={item.href} className="dash-action-link">
                {content}
              </Link>
            ) : (
              <div key={item.id}>{content}</div>
            );
          })}
        </div>
      )}
    </>
  );
}
