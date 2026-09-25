"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Lightbulb,
  ListOrdered,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  ImageIcon,
} from "lucide-react";
import { Navbar } from "@/components/akela/Navbar";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";
import { HELPDESK_SECTIONS } from "@/lib/helpdesk-content";
import {
  getHelpdeskBody,
  getHelpdeskImages,
  getHelpdeskSectionImages,
} from "@/lib/helpdesk-bodies";

const UI: Record<
  Locale,
  {
    back: string;
    notFound: string;
    notFoundSub: string;
    tipLabel: string;
    stepsLabel: string;
    related: string;
    allGuides: string;
    bitrixDemos: string;
  }
> = {
  uz: {
    back: "Yo'riqlar",
    notFound: "Maqola topilmadi",
    notFoundSub: "Bu ID uchun kontent hali qo'shilmagan.",
    tipLabel: "Maslahat",
    stepsLabel: "Qadamlar",
    related: "Boshqa yo'riqlar",
    allGuides: "Barcha yo'riqlar",
    bitrixDemos: "Bitrix24 interfeys rasmlari",
  },
  ru: {
    back: "Инструкции",
    notFound: "Статья не найдена",
    notFoundSub: "Контент для этого ID ещё не добавлен.",
    tipLabel: "Совет",
    stepsLabel: "Шаги",
    related: "Другие инструкции",
    allGuides: "Все инструкции",
    bitrixDemos: "Скриншоты интерфейса Битрикс24",
  },
  en: {
    back: "Guides",
    notFound: "Article not found",
    notFoundSub: "Content for this ID is not available yet.",
    tipLabel: "Tip",
    stepsLabel: "Steps",
    related: "More guides",
    allGuides: "All guides",
    bitrixDemos: "Bitrix24 interface screenshots",
  },
};

export default function GuideArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [locale, setLocale] = useState<Locale>("uz");
  const [activeImg, setActiveImg] = useState(0);
  const strings = UI_STRINGS[locale];
  const t = UI[locale];
  const body = getHelpdeskBody(id);

  const section = HELPDESK_SECTIONS.find((s) =>
    s.articles.some((a) => a.id === id),
  );
  const article = section?.articles.find((a) => a.id === id);

  const related = (section?.articles ?? []).filter((a) => a.id !== id).slice(0, 5);

  const articleImages =
    body?.images?.length
      ? body.images
      : getHelpdeskImages(id).length
        ? getHelpdeskImages(id)
        : section?.key
          ? getHelpdeskSectionImages(section.key)
          : [];
  const heroCover = article?.cover || section?.cover;

  useEffect(() => {
    const saved = localStorage.getItem("akela-locale") as Locale | null;
    if (saved === "uz" || saved === "ru" || saved === "en") setLocale(saved);
  }, []);

  if (!article || !body) {
    return (
      <main className="min-h-screen bg-transparent">
        <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />
        <div className="mx-auto max-w-3xl px-6 pt-32 pb-20 text-center">
          <BookOpen className="mx-auto mb-4 h-10 w-10 text-[color:var(--ink-soft)]" />
          <h1 className="text-2xl font-black text-[color:var(--emerald-deep)]">
            {t.notFound}
          </h1>
          <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
            {t.notFoundSub}
          </p>
          <Link
            href="/guides"
            className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-700 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg"
          >
            <ArrowLeft className="h-4 w-4" /> {t.back}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent">
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

      <article className="mx-auto max-w-3xl px-6 pt-28 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-bold">
            <Link
              href="/guides"
              className="inline-flex items-center gap-1 text-[color:var(--ink-soft)] hover:text-blue-600"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t.back}
            </Link>
            <ChevronRight className="h-3 w-3 opacity-40" />
            <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-sky-700">
              {section?.title[locale]}
            </span>
          </div>

          <div className="mb-3 flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white shadow-lg">
              <BookOpen className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <span className="rounded-full bg-sky-600/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-700">
                {locale === "uz" ? "Darslik" : locale === "ru" ? "Инструкция" : "Guide"}
              </span>
              <h1
                data-testid="guide-title"
                className="text-2xl font-black leading-tight text-[color:var(--emerald-deep)] sm:text-3xl"
              >
                {article.title[locale]}
              </h1>
            </div>
          </div>

          <p className="text-base leading-relaxed text-[color:var(--ink-soft)]">
            {body.intro[locale]}
          </p>

          {heroCover && (
            <div
              data-testid="guide-hero-cover"
              className="mt-5 overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroCover}
                alt={article.title[locale]}
                className="h-48 w-full object-cover sm:h-64"
              />
            </div>
          )}
        </motion.div>

        {articleImages.length > 0 && (
          <motion.section
            data-testid="guide-bitrix-images"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="mt-8 glass-card rounded-3xl p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-[color:var(--emerald-deep)]">
                {t.bitrixDemos}
              </h2>
              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-700">
                {activeImg + 1} / {articleImages.length}
              </span>
            </div>

            {/* Bitta katta rasm */}
            <figure
              data-testid="guide-bitrix-image"
              className="group relative mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={articleImages[activeImg]}
                alt={`${article.title[locale]} — ${activeImg + 1}`}
                className="max-h-[560px] w-full object-contain bg-slate-50"
              />
              {articleImages.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Oldingi rasm"
                    onClick={() =>
                      setActiveImg(
                        (i) => (i - 1 + articleImages.length) % articleImages.length,
                      )
                    }
                    className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow-lg transition hover:bg-white"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Keyingi rasm"
                    onClick={() => setActiveImg((i) => (i + 1) % articleImages.length)}
                    className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow-lg transition hover:bg-white"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </figure>

            {/* Rasm ostidagi izoh — nima qilinishi + Bitrix ma'lumotlari */}
            <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-600 text-white">
                  <ImageIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800">
                    {activeImg + 1}-rasm: {article.title[locale]}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {article.summary[locale]}
                  </p>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="guide-bitrix-source"
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-700 transition-colors hover:border-sky-400 hover:bg-sky-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {locale === "uz"
                      ? "Bitrix24 manbasida ochish"
                      : locale === "ru"
                        ? "Открыть в источнике Битрикс24"
                        : "Open in Bitrix24 source"}
                  </a>
                </div>
              </div>
            </div>

            {/* Miniatyuralar */}
            {articleImages.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {articleImages.map((src, i) => (
                  <button
                    key={`${src}-${i}`}
                    type="button"
                    onClick={() => setActiveImg(i)}
                    aria-label={`${i + 1}-rasm`}
                    className={`h-14 w-20 overflow-hidden rounded-lg border-2 transition ${
                      i === activeImg
                        ? "border-sky-500 shadow-md"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.section>
        )}

        <div className="mt-8 space-y-8">
          {body.sections.map((sec, i) => (
            <motion.section
              key={i}
              data-testid={`guide-section-${i}`}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: 0.04 * i }}
              className="glass-card rounded-3xl p-5 sm:p-6"
            >
              <h2 className="text-lg font-extrabold text-[color:var(--emerald-deep)]">
                {sec.title[locale]}
              </h2>
              {sec.text && (
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-soft)]">
                  {sec.text[locale]}
                </p>
              )}
              {sec.image && (
                <figure
                  data-testid="guide-section-image"
                  className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sec.image}
                    alt={sec.imageAlt?.[locale] || sec.title[locale]}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </figure>
              )}
              {sec.steps && (
                <ol className="mt-4 space-y-2.5">
                  {sec.steps[locale].map((step, si) => (
                    <li key={si} className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-sky-500 text-[11px] font-black text-white">
                        {si + 1}
                      </span>
                      <span className="text-sm leading-relaxed text-[color:var(--ink-soft)]">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </motion.section>
          ))}

          {body.tip && (
            <motion.aside
              data-testid="guide-tip"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-start gap-3 rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-orange-50/70 p-5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500 text-white shadow">
                <Lightbulb className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-amber-700">
                  {t.tipLabel}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-amber-950">
                  {body.tip[locale]}
                </p>
              </div>
            </motion.aside>
          )}
        </div>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-[color:var(--ink-soft)]">
              {t.related}
            </h2>
            <div className="flex flex-wrap gap-2">
              {related.map((a) => (
                <Link
                  key={a.id}
                  href={`/guides/${a.id}`}
                  data-testid="guide-related-link"
                  className="rounded-full border border-sky-200 bg-white/70 px-3.5 py-1.5 text-xs font-bold text-[color:var(--emerald-deep)] transition-colors hover:border-sky-400 hover:bg-sky-50"
                >
                  {a.title[locale]}
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/guides"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-700 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
          >
            <ArrowLeft className="h-4 w-4" /> {t.allGuides}
          </Link>
        </div>
      </article>
    </main>
  );
}
