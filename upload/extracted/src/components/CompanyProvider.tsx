"use client";

import { createContext, useContext } from "react";
import type { CompanySettings } from "@/lib/system-settings";
import { DEFAULT_SETTINGS } from "@/lib/system-settings";

const CompanyContext = createContext<CompanySettings>(DEFAULT_SETTINGS.company);

export function CompanyProvider({
  value,
  children,
}: {
  value: CompanySettings;
  children: React.ReactNode;
}) {
  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
