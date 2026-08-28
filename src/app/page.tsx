"use client";

import { useState, useCallback } from "react";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { Navbar } from "@/components/akela/Navbar";
import { Hero } from "@/components/akela/Hero";
import { OnboardingWizard } from "@/components/akela/OnboardingWizard";
import { CompanyStructure } from "@/components/akela/CompanyStructure";
import { DisciplineRules } from "@/components/akela/DisciplineRules";
import { Footer } from "@/components/akela/Footer";
import {
  ONBOARDING_STEPS,
  DISCIPLINE_RULES,
  UI_STRINGS,
  type Locale,
} from "@/lib/akela-content";

export default function HomePage() {
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];
  const steps = ONBOARDING_STEPS[locale];
  const rules = DISCIPLINE_RULES[locale];

  const goTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

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

      <CompanyStructure strings={strings} />

      <DisciplineRules rules={rules} strings={strings} />

      <Footer strings={strings} />
    </main>
  );
}
