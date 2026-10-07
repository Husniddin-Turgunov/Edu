import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { NavbarStatic } from "@/components/akela/NavbarStatic";

const ROOT = process.cwd();
const ART = path.join(ROOT, "public", "bitrix-data", "articles");
const INDEX = path.join(ROOT, "public", "bitrix-data", "index.json");

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));

type Block =
  | { k: "P" | "H2" | "H3" | "BLOCKQUOTE"; t: string }
  | { k: "LI"; list: "UL" | "OL"; t: string }
  | { k: "IMG"; n: number; local: string };

type Article = {
  id: string;
  title: string;
  section: string | null;
  sectionId: string | null;
  parent: string | null;
  short: string | null;
  toc: string[] | null;
  breadcrumb: string[] | null;
  articleMeta: string[] | null;
  related: { id: string; t: string }[] | null;
  blocks: Block[];
  images: { n: number; local: string }[];
};

function getIndex(lang = "ru") {
  const p = lang === "ru" ? INDEX : path.join(ROOT, "public", "bitrix-data", `index.${lang}.json`);
  try {
    return readJson(p) as { total: number; articles: Article[] };
  } catch {
    try { return readJson(INDEX) as { total: number; articles: Article[] }; }
    catch { return { total: 0, articles: [] as Article[] }; }
  }
}

function getArticle(id: string, lang: string): Article | null {
  // RU — asl fayl; uz/en — tarjima qilingan fayl (yo' bo'lsa RU'ga qaytadi)
  const name = lang === "ru" ? `${id}.json` : `${id}.${lang}.json`;
  try {
    return readJson(path.join(ART, name)) as Article;
  } catch {
    try {
      return readJson(path.join(ART, `${id}.json`)) as Article;
    } catch {
      return null;
    }
  }
}


export function generateStaticParams() {
  return getIndex().articles.map((a) => ({ id: a.id }));
}

export default async function ArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const lang = sp.lang === "uz" || sp.lang === "en" ? sp.lang : "ru";
  const art = getArticle(id, lang);
  if (!art) notFound();


  const index = getIndex(lang);
  const sections = [...new Set(index.articles.map((a) => a.section).filter(Boolean))] as string[];
  const inSection = index.articles.filter((a) => a.section === art.section);

  // "Коротко" ni kontent oxiridan chiqaramiz (Bitrixdagidek)
  const shortIdx = art.blocks.findIndex(
    (b) => b.k === "P" && typeof (b as { t: string }).t === "string" && /^Коротко/.test((b as { t: string }).t)
  );
  const body = art.blocks.filter((_, i) => i !== shortIdx);
  const toc = (art.toc ?? []).filter((t) => t && !/^Коротко/.test(t));

  const crumb = [...(art.breadcrumb ?? []), art.section, art.title].filter(Boolean) as string[];
  const related = (art.related ?? []).filter((r) => r.id !== id).slice(0, 6);

  return (
    <main className="min-h-screen bg-transparent">
      <NavbarStatic initial="uz" />

      <div className="mx-auto max-w-7xl px-4 pt-24 pb-20 lg:flex lg:gap-8">
        {/* ---- CHAP MENYU (Bitrix kabi) ---- */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
            <p className="mb-2 px-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
              Разделы
            </p>
            <ul className="space-y-0.5">
              {sections.map((s) => (
                <li key={s}>
                  <Link
                    href={`/guides?s=${encodeURIComponent(s)}`}
                    className={`block rounded-lg px-2.5 py-1.5 text-[13px] leading-snug transition-colors ${
                      s === art.section
                        ? "bg-sky-50 font-bold text-sky-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {s}
                    <span className="ml-1.5 text-[11px] text-slate-400">
                      {index.articles.filter((a) => a.section === s).length}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ---- MAQOLA ---- */}
        <article className="min-w-0 flex-1">
          {/* breadcrumb */}
          <nav className="mb-3 flex flex-wrap items-center gap-1 text-[12px] text-slate-500">
            <Link href="/guides" className="hover:text-sky-700">Главная</Link>
            {crumb.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-slate-300">›</span>
                <span className={i === crumb.length - 1 ? "font-semibold text-slate-700" : ""}>{c}</span>
              </span>
            ))}
          </nav>

          <h1 className="text-2xl font-black leading-tight text-[color:var(--emerald-deep)] sm:text-3xl">
            {art.title}
          </h1>

          {art.articleMeta && art.articleMeta.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-400">
              {art.articleMeta.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-8">
            {/* kontent — ketma-ket LI bloklari bitta ro'yxatga guruhlanadi */}
            <div className="min-w-0 flex-1">
              {(() => {
                const out: React.ReactNode[] = [];
                let run: Block[] = [];
                const flush = (key: string) => {
                  if (!run.length) return;
                  const ord = (run[0] as { list?: string }).list === "OL";
                  out.push(
                    <ul
                      key={key}
                      className={`mt-3 space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-700 ${
                        ord ? "list-decimal" : "list-disc"
                      }`}
                    >
                      {run.map((li, k) => (
                        <li key={k}>{(li as { t: string }).t}</li>
                      ))}
                    </ul>
                  );
                  run = [];
                };

                body.forEach((b, i) => {
                  if (b.k === "LI") {
                    run.push(b);
                    return;
                  }
                  flush(`ul-${i}`);
                  if (b.k === "IMG") {
                    out.push(
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={b.local}
                        alt=""
                        loading="lazy"
                        className="my-5 w-full rounded-xl border border-black/10"
                      />
                    );
                    return;
                  }
                  const t = (b as { t: string }).t;
                  if (!t) return;
                  if (b.k === "H2")
                    out.push(
                      <h2
                        key={i}
                        id={slug(t)}
                        className="mt-8 scroll-mt-24 text-[19px] font-extrabold leading-snug text-[color:var(--emerald-deep)]"
                      >
                        {t}
                      </h2>
                    );
                  else if (b.k === "H3")
                    out.push(
                      <h3 key={i} className="mt-5 text-[16px] font-bold text-slate-800">
                        {t}
                      </h3>
                    );
                  else
                    out.push(
                      <p key={i} className="mt-3 text-[15px] leading-relaxed text-slate-700">
                        {t}
                      </p>
                    );
                });
                flush("ul-end");
                return out;
              })()}


              {/* «Коротко» — Bitrixda kontent oxirida */}
              {art.short && (
                <div className="mt-10 rounded-2xl border-l-4 border-sky-500 bg-sky-50/70 px-5 py-4">
                  <p className="mb-1.5 text-[13px] font-black uppercase tracking-wide text-sky-700">
                    Коротко
                  </p>
                  <p className="text-[14px] leading-relaxed text-slate-700">{art.short}</p>
                </div>
              )}

              {/* «Похожие статьи» */}
              {related.length > 0 && (
                <section className="mt-10">
                  <h2 className="mb-3 text-[15px] font-extrabold text-slate-800">
                    Похожие статьи
                  </h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {related.map((r) => (
                      <Link
                        key={r.id}
                        href={`/guides/${r.id}?lang=${lang}`}
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-slate-700 transition-colors hover:border-sky-300 hover:text-sky-700"
                      >
                        {r.t || r.id}
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* «Статья вам помогла?» */}
              <section className="mt-10 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center">
                <p className="text-[14px] font-bold text-slate-700">Статья вам помогла?</p>
                <div className="mt-2.5 flex justify-center gap-2">
                  {["👍 Да", "👎 Нет"].map((x) => (
                    <span key={x} className="rounded-lg border border-slate-200 px-4 py-1.5 text-[13px] text-slate-500">
                      {x}
                    </span>
                  ))}
                </div>
              </section>
            </div>

            {/* «В этой статье» — o'ng panel */}
            {toc.length > 0 && (
              <aside className="hidden w-60 shrink-0 xl:block">
                <div className="sticky top-24">
                  <p className="mb-2 text-[12px] font-extrabold text-slate-700">В этой статье</p>
                  <ul className="space-y-1 border-l-2 border-slate-100 pl-3">
                    {toc.map((t, i) => (
                      <li key={i}>
                        <a
                          href={`#${slug(t)}`}
                          className="block text-[12px] leading-snug text-slate-500 hover:text-sky-700"
                        >
                          {t}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            )}
          </div>
        </article>
      </div>
    </main>
  );
}

function slug(s: string) {
  return "h-" + s.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60);
}
