import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, PageHeader } from "@/components/ui";
import { ensureDb } from "@/db/queries";
import { getSession } from "@/lib/auth";
import { runGlobalSearch } from "@/lib/global-search";

export const dynamic = "force-dynamic";

export default async function GlobalSearchPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");
  const params = (await searchParams) ?? {};
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const q = (raw ?? "").trim();
  await ensureDb();
  const hits = await runGlobalSearch(q, 12);

  return (
    <AppShell pathname="/search">
      <PageHeader
        title="Глобальный поиск"
        subtitle={
          q
            ? `Результаты по запросу «${q}»`
            : "Кандидаты, сотрудники, тесты, уроки, должности, аттестации"
        }
      />
      <form className="panel" action="/search" method="get">
        <label>
          Запрос
          <input name="q" defaultValue={q} placeholder="Иванов, Excel, Middle…" />
        </label>
        <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }}>
          Найти
        </button>
      </form>
      <section className="panel" style={{ marginTop: 16 }}>
        {q.length < 2 ? (
          <p className="muted">Введите минимум 2 символа.</p>
        ) : hits.length === 0 ? (
          <p className="muted">Ничего не найдено.</p>
        ) : (
          <div className="list">
            {hits.map((hit, index) => (
              <Link
                key={`${hit.href}-${index}`}
                href={hit.href}
                className="list-item"
              >
                <div>
                  <strong>{hit.title}</strong>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    {hit.kind}
                    {hit.meta ? ` · ${hit.meta}` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
