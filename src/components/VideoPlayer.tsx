"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Loader2,
  AlertCircle,
  Settings,
  Image as ImageIcon,
  Upload,
} from "lucide-react";

export interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  qualities?: { label: string; src: string }[];
  allowImageUpload?: boolean;
  /** Video tugaganda chaqiriladi (native pleer; YouTube iframe'da ishlamaydi) */
  onEnded?: () => void;
}

/** YouTube / Vimeo havolani embed manzilga aylantiradi (bo'lmasa null) */
export function getEmbedUrl(src: string): { type: "youtube" | "vimeo" | "tiktok"; embed: string } | null {
  try {
    const u = new URL(src.trim());
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    // YouTube: watch?v=, youtu.be/, /embed/, /shorts/
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
      let id = "";
      if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
      else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] || "";
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2] || "";
      else id = u.searchParams.get("v") || "";
      id = id.split("?")[0].split("&")[0];
      if (/^[\w-]{6,}$/.test(id)) {
        // YouTube boshqa videolarga o'tishni TAQIQLASH:
        //
        // `rel=0` YouTube tomonidan allaqachon e'tiborsiz qoldirilgan, shuning
        // uchun tavsiya videolari baribir ko'rinib turadi va keyin boshqa
        // videolarga o'tish mumkin bo'lardi.
        //
        // Ishi qiladigan parametr — `playlist=<o'z video id>`. YouTube "keyingi"
        // navbatini shu ro'yxatdan oladi, ya'ni navbatda faqat SHU video qoladi
        // va boshqa videolarga o'tib bo'lmaydi. Uning ustiga:
        //   - `modestbranding` — YouTube logotipi/bannerlarini kamaytiradi;
        //   - `iv_load_policy=3` — klaviatura/ekran ko'rsatkichini to'xtaydi
        //     (test savollari uchun klaviatura "chalg'i" bo'lib ketmasin);
        //   - `playsinline` — telefonda oyna kichraymasin;
        //   - `enablejsapi=0` — tashqi JS boshqaruvini o'chiradi.
        const params = [
          "rel=0",
          `playlist=${id}`,
          "modestbranding=1",
          "playsinline=1",
          "iv_load_policy=3",
          "enablejsapi=0",
          "autoplay=0",
        ].join("&");
        return { type: "youtube", embed: `https://www.youtube-nocookie.com/embed/${id}?${params}` };
      }
      return null;
    }
    // Vimeo: vimeo.com/<id>
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const m = u.pathname.match(/(\d{6,})/);
      if (m) return { type: "vimeo", embed: `https://player.vimeo.com/video/${m[1]}` };
      return null;
    }
    // TikTok: tiktok.com/@user/video/<id>
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
      const m = u.pathname.match(/\/video\/(\d{5,})/);
      if (m) return { type: "tiktok", embed: `https://www.tiktok.com/embed/v2/${m[1]}` };
      return null;
    }
  } catch {}
  return null;
}

export default function VideoPlayer({
  src,
  title,
  poster,
  qualities,
  allowImageUpload = false,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [activeQuality, setActiveQuality] = useState("auto");
  const [customPoster, setCustomPoster] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Manba turi: YouTube/Vimeo embed, .m3u8 (HLS) yoki progressiv (mp4/webm/...)
  //
  // DIqqAT: `getEmbedUrl` har chaqiruvda YANGI obyekt qaytaradi. Uni to'g'ridan-
  // to'g'ri `useEffect` dependency qilib olinsa, effekt har render'da qayta
  // ishga tushadi -> hls.js har safar vahshatga uchratiladi -> fatal
  // "bufferAppendNoProgress" -> ekranda "CORS" xatosi. Shu sababdan bu yerda
  // `currentSrc` bo'yicha MEMO qilinadi (manba o'zgarmasa effekt bir marta).
  const embed = useMemo(() => getEmbedUrl(currentSrc), [currentSrc]);
  const isHls = !embed && /\.m3u8(\?|#|$)/i.test(currentSrc);

  useEffect(() => {
    if (embed) {
      // Embed (YouTube/Vimeo) — iframe o'zi o'ynatadi, video element kerak emas
      setLoading(false);
      setError(null);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    setLoading(true);
    setError(null);
    let hls: any = null;
    let cancelled = false;
    let recovered = false;

    const fail = (msg: string) => {
      if (!cancelled) {
        setError(msg);
        setLoading(false);
      }
    };

    if (isHls) {
      // Safari — native HLS
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = currentSrc;
        const onMeta = () => setLoading(false);
        const onErr = () => fail("Video yuklanmadi. URL noto'g'ri yoki server ruxsat bermayapti (CORS).");
        video.addEventListener("loadedmetadata", onMeta);
        video.addEventListener("error", onErr);
        return () => {
          cancelled = true;
          video.removeEventListener("loadedmetadata", onMeta);
          video.removeEventListener("error", onErr);
        };
      }
      // Boshqa brauzerlar — hls.js
      (async () => {
        try {
          const mod = await import("hls.js");
          if (cancelled) return;
          const Hls = (mod as any).default || mod;
          if (!Hls.isSupported()) {
            fail("Brauzeringiz video formatini qo'llab-quvvatlamaydi");
            return;
          }
          hls = new Hls({ enableWorker: true });
          hls.loadSource(currentSrc);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!cancelled) setLoading(false);
          });
          hls.on(Hls.Events.ERROR, (_e: any, data: any) => {
            if (!data || !data.fatal) return;
            // Bu xatolar "server ruxsat bermadi" emas — tiklanadi:
            if (data.details === Hls.ErrorDetails.BUFFER_APPEND_NO_PROGRESS ||
                data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
                data.details === Hls.ErrorDetails.BUFFER_FULL) {
              try { hls.startLoad(); return; } catch {}
            }
            if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
                data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
              // manifest kalitidan tushib qolgan bo'lishi mumkin — bir marta
              // qayta yuklash, keyin xato ko'rsatamiz.
              if (!recovered) {
                recovered = true;
                setError(null);
                setLoading(true);
                try { hls.startLoad(); return; } catch {}
              }
            }
            fail(
              data.details
                ? `Video yuklanmadi (${data.details}). Manba serveriga ruxsat berilmagan bo'lishi mumkin.`
                : "Video yuklanmadi. URL noto'g'ri yoki server ruxsat bermayapti (CORS).",
            );
            try { hls.destroy(); } catch {}
          });
        } catch {
          fail("Video pleer yuklanmadi. Sahifani yangilab qayta urining.");
        }
      })();
      return () => {
        cancelled = true;
        try { hls?.destroy(); } catch {}
      };
    }

    // Progressiv fayl (mp4/webm/...) — brauzer native o'ynaydi
    video.src = currentSrc;
    const onMeta = () => {
      if (!cancelled) setLoading(false);
    };
    const onErr = () => fail("Video yuklanmadi. URL noto'g'ri, format qo'llanmaydi yoki server ruxsat bermayapti (CORS).");
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("error", onErr);
    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("error", onErr);
    };
  }, [currentSrc, isHls, embed]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
  };
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) setDuration(video.duration);
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setUploadedImage(dataUrl);
      setCustomPoster(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-slate-200/40">
      {title && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
          <h3 className="text-white font-semibold text-sm sm:text-base drop-shadow">{title}</h3>
        </div>
      )}

      {embed ? (
        <iframe
          key={embed.embed}
          src={embed.embed}
          title={(title || "Video").trim()}
          className="w-full aspect-video bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          /* `allow-popups` YO'Q — YouTube tavsiya linklari `target="_blank"`
             bilan ochilishi bloklanadi, ya'ni foydalanuvchi YouTube sahifasi
             yoki boshqa videoga o'ta olmaydi. `allow-same-origin` o'z
             manzilimizda o'ynash uchun kerak. */
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allowFullScreen
          onLoad={() => {
            setLoading(false);
            setError(null);
          }}
        />
      ) : (
      <video
        ref={videoRef}
        poster={customPoster || poster}
        playsInline
        className="w-full aspect-video bg-black"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => onEnded?.()}
      />
      )}

      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-12 w-12 animate-spin text-amber-400" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-6 text-center">
          <AlertCircle className="h-12 w-12 text-rose-400" />
          <p className="mt-3 text-white">{error}</p>
        </div>
      )}

      {!embed && !playing && !loading && !error && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/40"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 shadow-2xl transition hover:scale-110">
            <Play className="h-10 w-10 fill-slate-900 text-slate-900 ml-1" />
          </div>
        </button>
      )}

      {/* Uploaded image preview */}
      {uploadedImage && (
        <div className="absolute top-4 right-4 z-20 max-w-[200px] glass-card rounded-xl p-2 ring-1 ring-amber-300">
          <div className="flex items-center gap-1.5 mb-1">
            <ImageIcon className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] font-bold text-amber-900">Yangi rasm</span>
          </div>
          <img src={uploadedImage} alt="upload" className="w-full h-20 object-cover rounded-lg" />
        </div>
      )}

      {!embed && (
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
        <div
          className="mb-2 cursor-pointer"
          onClick={(e) => {
            const video = videoRef.current;
            if (!video) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            video.currentTime = pct * video.duration;
          }}
        >
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-indigo-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 text-white">
          <button onClick={togglePlay} className="hover:scale-110 transition-transform">
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-white" />}
          </button>
          <span className="text-xs tabular-nums">{fmt(currentTime)} / {fmt(duration)}</span>
          <div className="flex-1" />

          {/* Image upload (admin) */}
          {allowImageUpload && (
            <div className="relative">
              <button
                onClick={() => setShowUpload((v) => !v)}
                className="hover:scale-110 transition-transform"
                title="Rasm yuklash"
              >
                <Upload className="h-5 w-5" />
              </button>
              {showUpload && (
                <div className="absolute bottom-full right-0 mb-2 glass-card rounded-xl p-3 w-56 bg-white/95 backdrop-blur-xl">
                  <label className="block text-xs font-bold text-slate-800 mb-2">Rasm yuklash</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="block w-full text-xs text-slate-700 file:mr-2 file:rounded-md file:border-0 file:bg-amber-500 file:px-2 file:py-1 file:text-xs file:font-bold file:text-white hover:file:bg-amber-600"
                  />
                  {uploadedImage && (
                    <button
                      onClick={() => { setUploadedImage(null); setCustomPoster(null); }}
                      className="mt-2 text-xs text-rose-600 hover:underline"
                    >
                      ✗ O'chirish
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quality selector */}
          {qualities && qualities.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowSettings((v) => !v)}
                className="hover:scale-110 transition-transform"
                title="Sifat"
              >
                <Settings className="h-5 w-5" />
              </button>
              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 glass-card rounded-xl p-2 w-32 bg-white/95 backdrop-blur-xl">
                  <div className="text-[10px] font-bold text-slate-500 px-2 py-1">Sifat</div>
                  {qualities.map((q) => (
                    <button
                      key={q.label}
                      onClick={() => {
                        setActiveQuality(q.label);
                        setCurrentSrc(q.src);
                        setShowSettings(false);
                      }}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded-md font-semibold ${
                        activeQuality === q.label ? "bg-amber-100 text-amber-900" : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {q.label} {activeQuality === q.label ? "✓" : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button onClick={toggleMute} className="hover:scale-110 transition-transform">
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button onClick={() => containerRef.current?.requestFullscreen()} className="hover:scale-110 transition-transform">
            <Maximize2 className="h-5 w-5" />
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
