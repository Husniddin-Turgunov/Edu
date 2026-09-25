"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { Navbar } from "@/components/akela/Navbar";
import { Search, Play, Clock, HardDrive, Tag, ArrowLeft, Loader2 } from "lucide-react";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";
import { videoThumb } from "@/lib/video-thumb";
import { useMyCourses } from "@/hooks/useMyCourses";
import { NoAccess } from "@/components/akela/NoAccess";

export default function VideosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];
  const [search, setSearch] = useState("");
  const access = useMyCourses();
  // Videolar — API dan, eng yangi birinchi
  const [videos, setVideos] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/videos", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data?.ok) setVideos(data.videos);
      } catch {}
      if (!cancelled) setLoadingVideos(false);
    })();
    return () => { cancelled = true; };
  }, [status ]);

  const filtered = videos.filter((v: any) =>
    !search || v.title.toLowerCase().includes(search.toLowerCase()) || (v.category || "").toLowerCase().includes(search.toLowerCase())
  );

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

  // Video kutubxona — hech qanday dars biriktirilmagan bo'lsa yopiq
  if (!access.loading && !access.hasOnboarding && access.jobIds.length === 0) {
    return <NoAccess />;
  }

  return (
    <main className="min-h-screen bg-background">
      <LiquidBackground />
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

      <section className="relative pt-24 pb-12">
        <div className="mx-auto max-w-7xl px-6">
          <Link href="/courses" className="inline-flex items-center gap-2 text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)] mb-6">
            <ArrowLeft className="h-4 w-4" /> Kurslar
          </Link>
          <h1 className="text-4xl font-extrabold sm:text-5xl text-[color:var(--emerald-deep)]">
            🎬 Video darslar
          </h1>
          <p className="mt-4 max-w-2xl text-base text-[color:var(--ink-soft)] sm:text-lg">
            AKELA GROUP MACHINERY video darslar kutubxonasi. Sifatni o'zgartirishingiz mumkin.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 pb-12">
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--ink-soft)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Video qidirish..."
            className="w-full glass-card rounded-2xl px-12 py-3 text-sm text-[color:var(--emerald-deep)] placeholder:text-[color:var(--ink-soft)] outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {loadingVideos ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 glass-card rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : (
        <>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v: any, i: number) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: (i % 6) * 0.05 }}
            >
              <Link
                href={`/courses/videos/${v.id}`}
                className="group block glass-card rounded-3xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-2xl"
              >
                <div className="relative aspect-video bg-gradient-to-br from-[#0e1e3a] to-[#1a2855] overflow-hidden">
                  {videoThumb(v) && (
                    <img src={videoThumb(v)!} alt={v.title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur group-hover:bg-amber-500/90"
                    >
                      <Play className="h-8 w-8 fill-white text-white ml-1" />
                    </motion.div>
                  </div>
                  <div className="absolute bottom-2 right-2 rounded-md bg-black/80 px-2 py-0.5 text-xs font-bold text-white">{v.duration}</div>
                  <div className="absolute top-2 left-2">
                    <span className="rounded-full bg-rose-500/90 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">● VIDEO</span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-base font-extrabold leading-tight text-[color:var(--emerald-deep)] group-hover:text-amber-600 transition-colors">{v.title}</h3>
                  <p className="mt-2 text-sm text-[color:var(--ink-soft)] line-clamp-2">{v.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--ink-soft)]">
                    <span className="inline-flex items-center gap-1 rounded-md bg-black/5 px-2 py-0.5"><Tag className="h-3 w-3" /> {v.category}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-black/5 px-2 py-0.5"><Clock className="h-3 w-3" /> {v.duration}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-black/5 px-2 py-0.5"><HardDrive className="h-3 w-3" /> {v.size}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && !loadingVideos && (
          <div className="glass-card rounded-2xl p-10 text-center text-[color:var(--ink-soft)]">
            Video topilmadi
          </div>
        )}
        </>
        )}
      </div>
    </main>
  );
}
