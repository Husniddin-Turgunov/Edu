"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { Navbar } from "@/components/akela/Navbar";
import VideoPlayer from "@/components/VideoPlayer";
import { videoThumb } from "@/lib/video-thumb";
import { ArrowLeft, Loader2, Tag, Clock, HardDrive } from "lucide-react";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";
import { useMyCourses } from "@/hooks/useMyCourses";
import { NoAccess } from "@/components/akela/NoAccess";

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];
  const access = useMyCourses();

  // Video — API dan (eng yangi birinchi tartibda)
  const [video, setVideo] = useState<any | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(true);

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
        if (!cancelled && data?.ok) {
          setVideo((data.videos || []).find((v: any) => v.id === params.id) || null);
        }
      } catch {}
      if (!cancelled) setLoadingVideo(false);
    })();
    return () => { cancelled = true; };
  }, [status, params.id]);

  if (!access.loading && !access.hasOnboarding && access.jobIds.length === 0) {
    return <NoAccess />;
  }

  if (status === "loading" || loadingVideo) {
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

  if (!video) {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <LiquidBackground />
        <div className="relative glass-card rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">Video topilmadi</h1>
          <Link href="/courses/videos" className="mt-4 inline-block text-amber-600 underline">← Video darslar</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <LiquidBackground />
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

      <header className="relative pt-24 pb-6">
        <div className="mx-auto max-w-4xl px-6">
          <Link href="/courses/videos" className="inline-flex items-center gap-2 text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)]">
            <ArrowLeft className="h-4 w-4" /> Video darslar
          </Link>
          <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl text-[color:var(--emerald-deep)]">{video.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[color:var(--ink-soft)]">
            <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {video.category}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {video.duration}</span>
            <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> {video.size}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl overflow-hidden"
        >
          <VideoPlayer
            src={video.url}
            title={video.title}
            poster={video.poster || video.thumbnail || videoThumb(video) || undefined}
            qualities={video.qualities || [
              { label: "1080p", src: video.url },
              { label: "720p", src: video.url },
              { label: "360p", src: video.url },
            ]}
            allowImageUpload={(session?.user as any)?.role === "admin"}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-3xl p-8"
        >
          <h2 className="text-xl font-extrabold text-[color:var(--emerald-deep)] mb-4">📖 Video haqida</h2>
          <p className="text-[color:var(--ink-soft)] leading-relaxed">{video.description}</p>
        </motion.div>
      </div>
    </main>
  );
}
