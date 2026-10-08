"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Navbar } from "@/components/akela/Navbar";
import { Search, BookOpen, GraduationCap, Sparkles, Play, Clock, ClipboardCheck, FileText, Target, Timer } from "lucide-react";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";
import { AkelaOnboardingModal } from "@/components/akela/AkelaOnboardingModal";
import { TicketCard, TicketBadge } from "@/components/akela/TicketCard";
import { usePlacedVideos } from "@/components/akela/RelatedVideos";
import { groupVideos } from "@/lib/video-groups";
import { PlaylistCard } from "@/components/akela/PlaylistCard";

type Job = any;

// Yagona ko'k uyg'un palitra — barcha kartalar ko'k oilasida
const COLOR_GRADIENTS = [
  "from-blue-600 to-indigo-600",
  "from-sky-500 to-blue-600",
  "from-indigo-500 to-blue-600",
  "from-cyan-500 to-blue-600",
  "from-blue-500 to-indigo-700",
  "from-sky-600 to-indigo-600",
  "from-blue-700 to-indigo-600",
  "from-cyan-600 to-blue-700",
];

function pickColor(i: number) { return COLOR_GRADIENTS[i % COLOR_GRADIENTS.length]; }

export default function CoursesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];
  const [search, setSearch] = useState("");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [modulesData, setModulesData] = useState<any[]>([]);
  const [loadingOnboarding, setLoadingOnboarding] = useState(true);
  const [jobsData, setJobsData] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  // Atestatsiya testlari — faqat active (ko'rinadigan) testlar
  const [atestTests, setAtestTests] = useState<any[]>([]);
  const [loadingAtest, setLoadingAtest] = useState(true);
  // Biriktirish (assignment) holati: null = hali yuklanmoqda
  const [allowed, setAllowed] = useState<{ onboarding: boolean; jobIds: string[] } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/my-courses", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data?.ok) {
          setAllowed({
            onboarding: !!(data.isAdmin || data.onboarding),
            jobIds: data.isAdmin ? [] : (data.jobIds || []).map(String),
          });
          // admin uchun bo'sh jobIds = "barchasi" degani (pastda isAdmin tekshiriladi)
          if (data.isAdmin) setAllowed({ onboarding: true, jobIds: ["*"] });
        } else if (!cancelled) {
          setAllowed({ onboarding: false, jobIds: [] });
        }
      } catch {
        if (!cancelled) setAllowed({ onboarding: false, jobIds: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data?.ok && data.course?.modules) {
          setModulesData(data.course.modules);
        }
      } catch (e) {
        console.error("Failed to load onboarding", e);
      } finally {
        if (!cancelled) setLoadingOnboarding(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Atestatsiya testlari — faol (active) va foydalanuvchiga ruxsat etilgan testlar
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tests", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data?.ok && Array.isArray(data.tests)) {
          setAtestTests(data.tests);
        }
      } catch (e) {
        console.error("Failed to load attestation tests", e);
      } finally {
        if (!cancelled) setLoadingAtest(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data?.ok && Array.isArray(data.jobs)) {
          setJobsData(data.jobs);
        }
      } catch (e) {
        console.error("Failed to load jobs", e);
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Faqat biriktirilgan kasbiy kurslar (admin: barchasi). Biriktirilmagan user hech narsa ko'rmaydi.
  // Eslatma: /api/jobs da id="1" (jobId), cuid esa _id da — biriktirish cuid bilan solishtiriladi.
  const jobKey = (j: any) => String(j._id || j.id);
  const visibleJobs = jobsData.filter((j: any) => {
    if (!allowed) return false;
    if (allowed.jobIds.includes("*")) return true;
    return allowed.jobIds.includes(jobKey(j));
  });
  const filteredJobs = visibleJobs.filter((j: any) =>
    !search || j.title.toLowerCase().includes(search.toLowerCase()) || (j.folder || "").toLowerCase().includes(search.toLowerCase())
  );
  const showOnboarding = !!allowed?.onboarding;
  const hasAnything = showOnboarding || visibleJobs.length > 0;
  const stillLoading = loadingOnboarding || loadingJobs || !allowed;
  // Kurslar sahifasiga joylashtirilgan videolar polosasi
  const { courses: stripVideos } = usePlacedVideos();
  // "Video darslar" bo'limi uchun barcha videolar:
  //  - home sahifasida ko'rinadiganlar (showOnHome) — BU YERDA ko'rinmasligi kerak
  //  - dashboard ga qo'yilganlar (showOnDashboard) — bu yerda emas
  const [allVideos, setAllVideos] = useState<any[]>([]);
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/videos", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data?.ok) setAllVideos(data.videos || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [status]);
  const courseVideos = allVideos.filter(
    (v: any) => v.isActive !== false && !v.showOnHome && !v.showOnDashboard,
  );

  if (status === "loading") {
    return (
      <main className="min-h-screen grid place-items-center bg-transparent">
        <div className="relative glass-card rounded-3xl p-8 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-[color:var(--ink-soft)]">Yuklanmoqda...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent">
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

      <AkelaOnboardingModal
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        locale={locale}
      />

      {/* Hero header — cream style */}
      <section className="relative overflow-hidden pt-36 pb-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="section-eyebrow">AKELA GROUP MACHINERY</span>
          </div>
          <h1 className="text-4xl font-extrabold sm:text-5xl text-[color:var(--emerald-deep)]">
            O'quv kurslari
          </h1>
          <p className="mt-4 max-w-2xl text-base text-[color:var(--ink-soft)] sm:text-lg">
            Yangi xodim tanishtiruvi va 30 ta kasb bo'yicha 5 kunlik + 30 kunlik dasturlar. Har darsda test, har blokda yakuniy imtihon.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10 space-y-14">
        {/* Video darslar — playlistlar va oddiy videolar (alohida dizayn).
          Home/dashboard ga qo'yilgan videolar BU YERDA ko'rinmaydi. */}
        {courseVideos.length > 0 && (allowed?.onboarding || (allowed?.jobIds.length || 0) > 0) && (
          <section>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
                <Play className="h-5 w-5 fill-white ml-0.5" />
              </span>
              <h2 className="text-xl font-extrabold text-[color:var(--emerald-deep)] sm:text-2xl">Video darslar</h2>
              <Link href="/courses/videos" className="ml-auto text-sm font-bold text-blue-600 hover:underline">
                Barchasi →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groupVideos(courseVideos).map((row: any, i: number) =>
                row.kind === "playlist" ? (
                  <PlaylistCard
                    key={"pl-" + row.name}
                    name={row.name}
                    videos={row.videos}
                    onOpen={() => { location.href = "/courses/videos?cat=" + encodeURIComponent(row.name); }}
                  />
                ) : (
                  // Oddiy videolar — playlistdan BOSHQACHA (yengil) dizayn
                  <Link
                    key={row.video.id}
                    href={"/courses/videos/" + row.video.id}
                    className="group rounded-2xl border border-white/70 bg-white/70 p-3 transition-all hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-[#0e1e3a] to-[#1a2855] grid place-items-center">
                      <Play className="h-8 w-8 fill-white/90 text-white/90 ml-0.5" />
                      {row.video.duration && (
                        <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-bold text-white">
                          {row.video.duration}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 block truncate text-sm font-extrabold text-[color:var(--emerald-deep)] group-hover:text-blue-600">
                      {row.video.title}
                    </div>
                    <div className="mt-1 text-[11px] text-[color:var(--ink-soft)]">
                      {row.video.category || "Tizim"}
                    </div>
                  </Link>
                )
              )}
            </div>
          </section>
        )}

{/* Atestatsiya testlari — yaratilgan va ko'rishga ruxsat etilgan (active) testlar */}
        {loadingAtest || atestTests.length > 0 ? (
        <section data-testid="atestatsiya-section">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div>
              <span className="section-eyebrow">Yakuniy baholash</span>
              <h2 className="text-2xl font-extrabold text-[color:var(--emerald-deep)] sm:text-3xl">Atestatsiya testlari</h2>
            </div>
            {!loadingAtest && (
              <span className="ml-auto glass-pill text-sm font-bold text-[color:var(--emerald-deep)]">
                {atestTests.length} ta
              </span>
            )}
          </div>
          <p className="text-sm text-[color:var(--ink-soft)] mb-6">
            O&apos;quv darslarini tugatgandan so&apos;ng topshiradigan atestatsiya (yakuniy baholash) testlari.
            Natijangiz sertifikat uchun asos bo&apos;lib xizmat qiladi.
          </p>

          {loadingAtest ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 glass-card rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : atestTests.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center text-[color:var(--ink-soft)]">
              Hozircha atestatsiya testlari mavjud emas.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {atestTests.map((t: any, i: number) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.55, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -6 }}
                >
                  <TicketCard
                    href={`/tests/${t.id}`}
                    gradient="from-amber-500 to-orange-600"
                    icon={<FileText className="h-6 w-6" />}
                    numberLabel={String(i + 1).padStart(2, "0")}
                    topLeftBadge={
                      <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink-soft)]">
                        Atestatsiya
                      </span>
                    }
                    topRightLabel={t.questionCount ? `${t.questionCount} savol` : undefined}
                    topRightTitle={
                      t.limited
                        ? `Bazada ${t.totalQuestions} savol — har urinishda ${t.questionCount} tasi tasodifiy tanlanadi`
                        : undefined
                    }
                    title={t.title}
                    description={
                      <span className="line-clamp-2">
                        {t.description || t.moduleTitle || "Atestatsiya testi"}
                      </span>
                    }
                    footer={
                      <>
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-blue-600">
                          Topshirish <span>→</span>
                        </span>
                        <span className="ml-auto flex items-center gap-3 text-[10px] font-semibold text-[color:var(--ink-soft)]">
                          {t.timeLimit ? (
                            <span className="inline-flex items-center gap-0.5">
                              <Timer className="h-3 w-3" /> {t.timeLimit} daq
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-0.5">
                            <Target className="h-3 w-3" /> {t.passScore}%
                          </span>
                        </span>
                      </>
                    }
                  />
                </motion.div>
              ))}
            </div>
          )}
        </section>
        ) : null}

        {/* Biriktirilmagan foydalanuvchi uchun bo'sh holat */}
        {!stillLoading && !hasAnything && (
          <div className="glass-card rounded-3xl p-12 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
              <BookOpen className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">Sizga hali dars biriktirilmagan</h2>
            <p className="mt-3 max-w-md mx-auto text-sm text-[color:var(--ink-soft)] leading-relaxed">
              Darslar admin tomonidan biriktirilgandan so&apos;ng shu yerda ko&apos;rinadi.
              Iltimos, rahbaringiz yoki admin bilan bog&apos;laning.
            </p>
          </div>
        )}

        {/* Onboarding — faqat biriktirilgan bo'lsa */}
        {showOnboarding && (
        <section>
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <span className="section-eyebrow">Modul 1-4</span>
              <h2 className="text-2xl font-extrabold text-[color:var(--emerald-deep)] sm:text-3xl">Tanishtiruv kursi</h2>
            </div>
            <span className="ml-auto glass-pill text-sm font-bold text-[color:var(--emerald-deep)]">
              {modulesData.reduce((s: number, m: any) => s + (m.lessons?.length ?? 0), 0)} dars
            </span>
            <button
              onClick={() => setOnboardingOpen(true)}
              className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:shadow-lg hover:scale-[1.02] active:scale-100"
            >
              <Sparkles className="h-4 w-4" />
              Ko&apos;proq bilish
            </button>
          </div>
          <p className="text-sm text-[color:var(--ink-soft)] mb-6">Yangi xodimlar uchun AKELA GROUP MACHINERY bilan tanishtiruv — tarix, qoidalar, tuzilma, tijorat sirlari.</p>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {loadingOnboarding ? (
              <div className="glass-card rounded-3xl p-10 text-center text-[color:var(--ink-soft)] md:col-span-2 lg:col-span-3">
                <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                Darslar yuklanmoqda...
              </div>
            ) : modulesData.length === 0 ? (
              <div className="glass-card rounded-3xl p-10 text-center text-[color:var(--ink-soft)] md:col-span-2 lg:col-span-3">
                Hozircha darslar mavjud emas. Admin panel orqali qo&apos;shing.
              </div>
            ) : (
              modulesData.map((m: any, i: number) => {
                const lessons: any[] = m.lessons || [];
                const testCount = lessons.filter((l: any) => l.title?.toLowerCase().includes("test")).length;
              return (
                <motion.div
                  key={m.id ?? m.order ?? i}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.55, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -6 }}
                >
                  <TicketCard
                    href={`/courses/onboarding/${m.order ?? i}/0`}
                    gradient={pickColor(i)}
                    icon={<GraduationCap className="h-6 w-6" />}
                    numberLabel={String(i + 1).padStart(2, "0")}
                    topLeftBadge={<span className="text-[10px] uppercase tracking-wider font-semibold text-[color:var(--ink-soft)]">Modul {i + 1}</span>}
                    topRightLabel={`${lessons.length} dars${testCount ? ` · ✏️ ${testCount}` : ""}`}
                    title={m.title}
                    description={
                      <span>
                        {lessons.slice(0, 3).map((l: any) => l.title).join(" · ")}
                        {lessons.length > 3 && ` · +${lessons.length - 3} ta`}
                      </span>
                    }
                    footer={
                      <>
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-blue-600">Boshlash <span>→</span></span>
                        <span className="ml-auto text-[10px] font-semibold text-[color:var(--ink-soft)]">{lessons.length} dars</span>
                      </>
                    }
                  />
                  </motion.div>
              );
            })
            )}
          </div>
        </section>
        )}

        {/* Jobs — faqat biriktirilgan kasblar */}
        {visibleJobs.length > 0 && (
        <section>
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <span className="section-eyebrow">{visibleJobs.length} ta kasb</span>
              <h2 className="text-2xl font-extrabold text-[color:var(--emerald-deep)] sm:text-3xl">Kasbiy kurslar</h2>
            </div>
            <span className="ml-auto glass-pill text-sm font-bold text-[color:var(--emerald-deep)]">
              {visibleJobs.length} ta
            </span>
          </div>

          <div className="mb-5 relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--ink-soft)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Kasb qidirish (masalan: Buxgalter, Marketolog...)"
              className="w-full glass-card rounded-2xl px-12 py-3 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {loadingJobs ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1,2,3].map(i => <div key={i} className="h-40 glass-card rounded-3xl animate-pulse" />)}
            </div>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredJobs.map((j: any, i: number) => {
              const totalDays = (j.parts || []).reduce((s: number, p: any) => s + (p.days?.length || 0), 0);
              return (
                <motion.div
                  key={j.id}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.55, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -6 }}
                >
                  <TicketCard
                    href={`/courses/job/${j.slug}`}
                    gradient={pickColor(i + 2)}
                    icon={<BookOpen className="h-6 w-6" />}
                    numberLabel={String(i + 1).padStart(2, "0")}
                    topLeftBadge={<span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold text-[color:var(--ink-soft)]">#{j.id}</span>}
                    topRightLabel={`${totalDays} kun`}
                    title={j.title}
                    footer={
                      <>
                        <TicketBadge variant="emerald">5 kunlik</TicketBadge>
                        <TicketBadge variant="violet">30 kunlik</TicketBadge>
                        {j.hasNormative && <TicketBadge variant="amber">📊 Normativ</TicketBadge>}
                      </>
                    }
                  />
                </motion.div>
              );
            })}
          </div>
          )}
          {!loadingJobs && filteredJobs.length === 0 && (
            <div className="glass-card rounded-2xl p-10 text-center text-[color:var(--ink-soft)]">
              Hech narsa topilmadi
            </div>
          )}
        </section>
        )}
      </div>
    </main>
  );
}

