import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, PageHeader } from "@/components/ui";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  return (
    <AppShell pathname="/help">
      <PageHeader
        title="Помощь"
        subtitle="Краткая навигация по платформе AKELA Assess"
      />
      <section className="panel stack" style={{ gap: 12, maxWidth: 720 }}>
        <p>
          Логотип AKELA слева всегда возвращает на <strong>Рабочий стол</strong>
          — ежедневные задачи, воронку и статистику.
        </p>
        <ul className="muted" style={{ lineHeight: 1.7 }}>
          <li>
            <Link href="/candidates">Найм</Link> — кандидаты, собеседования,
            тесты, пятидневка
          </li>
          <li>
            <Link href="/employees">Сотрудники</Link> — люди, оргструктура,
            наставники
          </li>
          <li>
            <Link href="/learning">Обучение и развитие</Link> — программы,
            уроки, аттестации
          </li>
          <li>
            <Link href="/competencies">Должности и материалы</Link> —
            справочники и библиотеки
          </li>
          <li>
            <Link href="/reports">Отчёты</Link> — Excel / PDF и аналитика
          </li>
          <li>
            <Link href="/integrations">Управление системой</Link> — интеграции,
            пользователи, настройки
          </li>
        </ul>
        <p>
          <Link href="/admin/profile" className="btn btn-primary">
            Профиль администратора
          </Link>{" "}
          <Link href="/search" className="btn btn-ghost">
            Глобальный поиск
          </Link>
        </p>
      </section>
    </AppShell>
  );
}
