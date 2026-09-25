import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, PageHeader } from "@/components/ui";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MethodologyTemplatesPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  return (
    <AppShell pathname="/methodology/templates">
      <PageHeader
        title="Шаблоны отчётов"
        subtitle="Шаблоны Excel/PDF и заготовки для тестов и ежедневных отчётов."
      />
      <section className="panel stack" style={{ gap: 12 }}>
        <p className="muted">
          Готовые выгрузки и шаблоны доступны из отчётов и библиотеки тестов.
        </p>
        <p>
          <Link href="/reports" className="btn btn-primary">
            Отчёты (Excel / PDF)
          </Link>{" "}
          <Link href="/api/test-template" className="btn btn-ghost">
            Шаблон теста Excel
          </Link>{" "}
          <Link href="/assessments?hub=methodology" className="btn btn-ghost">
            Библиотека тестов
          </Link>
        </p>
      </section>
    </AppShell>
  );
}
