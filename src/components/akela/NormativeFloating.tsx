"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, X, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

type NormativeData = {
  positionName: string;
  departmentName: string;
  normativeUrl: string;
  normativeDesc: string | null;
};

export function NormativeFloating({ department, position }: { department?: string; position?: string }) {
  const [data, setData] = useState<NormativeData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [showDesc, setShowDesc] = useState(false);

  useEffect(() => {
    if (!department || !position) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/user/normative?department=${encodeURIComponent(department)}&position=${encodeURIComponent(position)}`);
        const json = await res.json();
        if (!cancelled && json.ok && json.normative) {
          setData(json.normative);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [department, position]);

  if (!data) return null;

  return (
    <AnimatePresence>
      {isMinimized ? (
        /* ═══ Minimized fab ═══ */
        <motion.button
          key="fab"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { setIsMinimized(false); setIsOpen(true); }}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 px-5 py-3 text-white shadow-2xl shadow-blue-900/40 hover:shadow-blue-900/60 transition-shadow"
          aria-label="Normativ faylni ochish"
        >
          <FileText className="h-5 w-5" />
          <span className="text-sm font-bold hidden sm:inline">Normativ</span>
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
        </motion.button>
      ) : (
        /* ═══ Open panel ═══ */
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.9 }}
          transition={{ type: "spring", damping: 22, stiffness: 260 }}
          className="fixed bottom-6 right-6 z-40 w-[360px] max-w-[calc(100vw-3rem)] rounded-2xl bg-white border border-neutral-200 shadow-2xl shadow-blue-900/20 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <FileText className="h-5 w-5 text-white" />
              <div>
                <p className="text-sm font-bold text-white">Normativ hujjat</p>
                <p className="text-[10px] text-blue-200">{data.departmentName} → {data.positionName}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setShowDesc(!showDesc)} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors" title="Tavsif">
                {showDesc ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <button onClick={() => { setIsMinimized(true); setIsOpen(false); }} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors" title="Yopish">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Description (animated) */}
          <AnimatePresence>
            {showDesc && data.normativeDesc && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-700 leading-relaxed">{data.normativeDesc}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Body */}
          <div className="p-5 space-y-4">
            <p className="text-sm text-neutral-600 leading-relaxed">
              Sizning <span className="font-bold text-neutral-900">{data.positionName}</span> lavozimingiz uchun normativ hujjat mavjud.
              Quyidagi tugmani bosib faylni ko'ring yoki yuklab oling.
            </p>

            <div className="flex gap-2">
              <a
                href={data.normativeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-900/25"
              >
                <FileText className="h-4 w-4" /> Ochish
              </a>
              <a
                href={data.normativeUrl}
                download
                className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Yuklab olish
              </a>
            </div>

            {!data.normativeDesc && (
              <button onClick={() => setShowDesc(true)} className="text-xs text-blue-600 hover:underline">
                Bu fayl nima uchun kerak? →
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
