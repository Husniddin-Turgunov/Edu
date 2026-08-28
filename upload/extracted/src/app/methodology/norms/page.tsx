import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, PageHeader } from "@/components/ui";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MethodologyNormsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  return (
    <AppShell pathname="/methodology/norms">
      <PageHeader
        title="Нормативы"
        subtitle="Справочник нормативов по должностям. Карточки должностей и связанные уроки/тесты."
      />
      <section className="panel stack" style={{ gap: 12 }}>
        <p className="muted">
          Нормативы и критерии повышения хранятся в профиле должности. Откройте
          должность, чтобы настроить обязанности, уровни и связанные материалы.
        </p>
        <p>
          <Link href="/competencies?hub=methodology" className="btn btn-primary">
            Открыть должности
          </Link>{" "}
          <Link href="/assessments?hub=methodology" className="btn btn-ghost">
            Библиотека тестов
          </Link>{" "}
          <Link
            href="/learning?focus=programs&hub=methodology"
            className="btn btn-ghost"
          >
            Программы обучения
          </Link>
        </p>
      </section>
    </AppShell>
  );
}
