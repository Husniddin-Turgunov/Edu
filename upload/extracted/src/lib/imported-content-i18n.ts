"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "./i18n";

const translationCache = new Map<string, string>();

function cacheKey(locale: Locale, value: string) {
  return `${locale}\u0000${value}`;
}

/**
 * Localizes content imported from Excel/Drive. Russian remains the source
 * language; Uzbek and English are fetched in batches and cached for the
 * current browser session.
 */
export function useImportedContent(
  values: Array<string | null | undefined>,
  locale: Locale,
) {
  const signature = values.map((value) => value ?? "").join("\u0001");
  const uniqueValues = useMemo(
    () => [...new Set(values.map((value) => value ?? "").filter(Boolean))],
    // signature intentionally tracks string content, not array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );
  const [, render] = useState(0);

  useEffect(() => {
    if (locale === "ru" || uniqueValues.length === 0) return;
    const missing = uniqueValues.filter(
      (value) => !translationCache.has(cacheKey(locale, value)),
    );
    if (!missing.length) return;

    const controller = new AbortController();
    void fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: missing, target: locale }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Translation failed: ${response.status}`);
        return response.json() as Promise<{ translations?: string[] }>;
      })
      .then(({ translations }) => {
        if (!Array.isArray(translations)) return;
        missing.forEach((value, index) => {
          translationCache.set(
            cacheKey(locale, value),
            translations[index] || value,
          );
        });
        render((version) => version + 1);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name !== "AbortError") {
          console.error("Imported content translation failed", error);
        }
      });

    return () => controller.abort();
  }, [locale, uniqueValues]);

  return (value: string | null | undefined) => {
    const source = value ?? "";
    if (!source || locale === "ru") return source;
    return translationCache.get(cacheKey(locale, source)) ?? source;
  };
}
