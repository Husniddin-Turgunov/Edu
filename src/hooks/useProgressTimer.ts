"use client";

import { useEffect, useRef, useCallback } from "react";

type Args = {
  lessonId?: string | null;
  jobDayId?: string | null;
  /** Har N soniyada yurak urishi yuboriladi */
  intervalSec?: number;
};

/**
 * Darsda o'tkazilgan vaqtni serverga yozadi.
 * - Har intervalSec da { seconds } ping
 * - Sahifa yopilganda qolgan vaqt (keepalive)
 * - finish() chaqirilsa { completed: true }
 */
export function useProgressTimer({ lessonId, jobDayId, intervalSec = 30 }: Args) {
  const idRef = useRef({ lessonId: lessonId || null, jobDayId: jobDayId || null });
  const accRef = useRef(0);
  const lastRef = useRef<number>(Date.now());
  const doneRef = useRef(false);

  // Refni render paytida emas, effect ichida yangilaymiz (react-hooks/refs qoidasi).
  // Effect declaration tartibiga ko'ra asosiy effectdan OLDIN ishlaydi.
  useEffect(() => {
    idRef.current = { lessonId: lessonId || null, jobDayId: jobDayId || null };
  }, [lessonId, jobDayId]);

  const send = useCallback(async (seconds: number, completed: boolean, keepalive = false) => {
    const { lessonId: lid, jobDayId: jid } = idRef.current;
    if (!lid && !jid) return;
    if (seconds <= 0 && !completed) return;
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lid, jobDayId: jid, seconds, completed }),
        keepalive,
      });
    } catch {
      // jimjitlikda e'tiborsiz qoldiramiz (keyingi pingda qo'shiladi)
    }
  }, []);

  // Faol ko'rish vaqtini yig'ish (yashirin tabda to'xtaydi)
  useEffect(() => {
    accRef.current = 0;
    lastRef.current = Date.now();
    doneRef.current = false;

    const tick = () => {
      if (document.hidden) {
        lastRef.current = Date.now();
        return;
      }
      const now = Date.now();
      accRef.current += Math.min(120, Math.floor((now - lastRef.current) / 1000));
      lastRef.current = now;
    };
    const iv = setInterval(async () => {
      tick();
      const s = accRef.current;
      accRef.current = 0;
      if (s > 0) await send(s, false);
    }, Math.max(10, intervalSec) * 1000);

    const onVis = () => {
      lastRef.current = Date.now();
    };
    const onHide = () => {
      tick();
      const s = accRef.current;
      accRef.current = 0;
      if (s > 0) void send(s, false, true);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      // Unmount: qolgan vaqtni yuborish
      const now = Date.now();
      const tail = Math.min(120, Math.floor((now - lastRef.current) / 1000));
      const s = accRef.current + tail;
      if (s > 0) void send(s, false, true);
    };
  }, [lessonId, jobDayId, intervalSec, send]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const now = Date.now();
    const tail = Math.min(120, Math.floor((now - lastRef.current) / 1000));
    const s = accRef.current + tail;
    accRef.current = 0;
    lastRef.current = now;
    void send(s, true, true);
  }, [send]);

  return { finish };
}
