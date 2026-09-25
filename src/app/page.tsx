"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { Navbar } from "@/components/akela/Navbar";
import { Hero } from "@/components/akela/Hero";
import { OnboardingWizard } from "@/components/akela/OnboardingWizard";
import { CompanyStructure } from "@/components/akela/CompanyStructure";
import { DisciplineRules } from "@/components/akela/DisciplineRules";
import { HelpdeskGuides } from "@/components/akela/HelpdeskGuides";
import { Footer } from "@/components/akela/Footer";
import { NormativeFloating } from "@/components/akela/NormativeFloating";
import VideoPlayer from "@/components/VideoPlayer";
import { videoThumb } from "@/lib/video-thumb";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Play, Clock, Settings, Loader2, Shield } from "lucide-react";
import {
  ONBOARDING_STEPS,
  DISCIPLINE_RULES,
  UI_STRINGS,
  type Locale,
} from "@/lib/akela-content";

type HomeVideo = {
  id: string;
  title: string;
  description: string;
  duration: string;
  url: string;
  poster?: string | null;
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];
  const steps = ONBOARDING_STEPS[locale];
  const rules = DISCIPLINE_RULES[locale];
  // Videolar — API dan placement tartibida. Admin joylashtirgan videolar chiqadi.
  const [homeVideos, setHomeVideos] = useState<HomeVideo[]>([]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/videos", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data?.ok) setHomeVideos(data.home || data.videos || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [status ]);

  // Tanlangan video featured o'rniga chiqadi (pastdagini bossangiz yuqoriga almashadi)
  const [firstId, setFirstId] = useState<string | null>(null);
  const featured = (firstId && homeVideos.find((v) => v.id === firstId)) || homeVideos[0] || null;
  const recent = homeVideos.filter((v) => v.id !== featured?.id).slice(0, 3);

  const selectVideo = (id: string) => {
    setFirstId(id);
    document.getElementById("video")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Video tugagach — hamma narsa o'z joyiga qaytadi (boshlang'ich tartib)
  const resetAfterEnd = () => {
    setFirstId(null);
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Scroll to section if URL has hash
  useEffect(() => {
    if (status === "authenticated" && window.location.hash) {
      const id = window.location.hash.slice(1);
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top, behavior: "smooth" });
        }
      }, 100);
    }
  }, [status]);

  const goTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  if (status === "loading") {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <LiquidBackground />
        <div className="relative glass-card rounded-3xl p-8 text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm text-[color:var(--ink-soft)]">Yuklanmoqda...</p>
        </div>
      </main>
    );
  }

  if (!session) return null;

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <LiquidBackground />
      <Navbar
        locale={locale}
        strings={strings}
        onLocaleChange={setLocale}
      />

      <Hero
        strings={strings}
        onStart={() => goTo("onboarding")}
        onExplore={() => goTo("structure")}
      />

      <OnboardingWizard
        steps={steps}
        strings={strings}
        onLocale={setLocale}
        locale={locale}
      />

      <CompanyStructure strings={strings} locale={locale} />

      <DisciplineRules rules={rules} strings={strings} />

      {/* ===== Bitrix 24 yo'riqlari — videolardan OLDIN ===== */}
      <section className="relative px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <HelpdeskGuides locale={locale} id="bitrix-guides" compact />
        </div>
      </section>

      {/* Video section — eng yangi video avtomatik chiqadi (yangisi oldinda) */}
      {featured && (
      <section id="video" className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-8 text-center">
              <span className="section-eyebrow">Video darslik</span>
              <h2 className="mt-3 text-3xl font-extrabold text-[color:var(--emerald-deep)] sm:text-4xl">
                So&apos;nggi video dars
              </h2>
              <p className="mt-3 max-w-xl mx-auto text-[color:var(--ink-soft)]">
                AKELA GROUP korxonasiga birinchi qadam — video dars orqali tanishing.
                Sifatni o'zgartirishingiz mumkin.
              </p>
            </div>

            <LayoutGroup>
            <AnimatePresence mode="popLayout">
            <motion.div
              key={featured.id}
              layout
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -16 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="glass-card rounded-3xl overflow-hidden max-w-4xl mx-auto"
            >
              <div className="bg-gradient-to-br from-[#0e1e3a] via-[#1a2855] to-[#374187] p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-rose-500/30 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                    VIDEO
                  </span>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                    YANGI
                  </span>
                  {featured.duration && (
                    <span className="text-[10px] text-white/60 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {featured.duration}
                    </span>
                  )}
                </div>
                <h3 className="text-white font-extrabold text-lg">{featured.title}</h3>
                {featured.description && <p className="text-xs text-white/60 mt-1">{featured.description}</p>}
              </div>
              <VideoPlayer
                key={`player-${featured.id}`}
                src={featured.url}
                title={featured.title}
                poster={videoThumb(featured) || undefined}
                onEnded={resetAfterEnd}
                qualities={[
                  { label: "1080p", src: featured.url },
                  { label: "720p", src: featured.url },
                  { label: "360p", src: featured.url },
                ]}
                allowImageUpload={(session?.user as any)?.role === "admin"}
              />
            </motion.div>
            </AnimatePresence>

            {recent.length > 0 && (
              <div className="mt-6 grid gap-4 sm:grid-cols-3 max-w-4xl mx-auto">
                {recent.map((v: any) => {
                  const thumb = videoThumb(v);
                  return (
                    <motion.button
                      layout
                      key={v.id}
                      onClick={() => selectVideo(v.id)}
                      title="Ko'rish — yuqoridagi bilan o'rin almashish"
                      whileTap={{ scale: 0.97 }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      className="group liquid-video-card text-left"
                    >
                      <div className="relative aspect-video bg-gradient-to-br from-[#0e1e3a] to-[#1a2855] overflow-hidden rounded-t-[1.1rem]">
                        {thumb ? (
                          <img src={thumb} alt={v.title} className="absolute inset-0 h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500" loading="lazy" />
                        ) : null}
                        <div className="absolute inset-0 grid place-items-center bg-black/5 group-hover:bg-black/10 transition-colors duration-500">
                          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/30 backdrop-blur-md border border-white/40 transition-all duration-500 group-hover:scale-115 group-hover:bg-blue-600/80 group-hover:border-blue-400/50 shadow-lg shadow-black/10">
                            <Play className="h-5 w-5 fill-white text-white ml-0.5" />
                          </span>
                        </div>
                        {v.duration && (
                          <span className="absolute bottom-2 right-2 rounded-lg bg-black/70 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white border border-white/10">
                            {v.duration}
                          </span>
                        )}
                      </div>
                      <div className="relative z-10 p-4">
                        <h4 className="text-sm font-extrabold text-[color:var(--emerald-deep)] group-hover:text-blue-600 transition-colors duration-300 line-clamp-2 drop-shadow-sm">
                          {v.title}
                        </h4>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
            </LayoutGroup>

            <div className="mt-6 text-center">
              <Link
                href="/courses/videos"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-700 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-900/20 transition-transform hover:scale-105"
              >
                <Play className="h-4 w-4" /> Barcha videolarni ko'rish
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
      )}

      <Footer strings={strings} />

      {/* Normativ fayl suzuvchi oyna */}
      {(session?.user as any)?.department && (session?.user as any)?.position && (
        <NormativeFloating
          department={(session?.user as any).department}
          position={(session?.user as any).position}
        />
      )}
    </main>
  );
}
