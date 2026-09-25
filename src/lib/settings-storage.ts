import fs from "fs";
import path from "path";

export type PortalSettings = {
  registrationOpen: boolean;
  supportContact: string;
};

const DEFAULTS: PortalSettings = {
  registrationOpen: true,
  supportContact: "",
};

function settingsPath() {
  return path.join(process.cwd(), "src", "data", "portal-settings.json");
}

export function getSettings(): PortalSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch: Partial<PortalSettings>): PortalSettings {
  const next: PortalSettings = {
    registrationOpen:
      typeof patch.registrationOpen === "boolean"
        ? patch.registrationOpen
        : getSettings().registrationOpen,
    supportContact:
      typeof patch.supportContact === "string"
        ? patch.supportContact.slice(0, 200)
        : getSettings().supportContact,
  };
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), "utf8");
  } catch {
    // diskka yozilmasa ham keshdagi qiymat qaytadi
  }
  return next;
}
