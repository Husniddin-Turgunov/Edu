export const INTEGRATION_SYSTEMS = [
  "telegram",
  "verifix",
  "bitrix",
  "smtp",
  "storage",
] as const;

export type IntegrationSystem = (typeof INTEGRATION_SYSTEMS)[number];

export function isIntegrationSystem(value: string): value is IntegrationSystem {
  return (INTEGRATION_SYSTEMS as readonly string[]).includes(value);
}

export type TelegramConfig = {
  token: string;
  webhookSecret: string;
  notifyInterviews: boolean;
  notifyTests: boolean;
  notifyHiring: boolean;
  formsEnabled: boolean;
  geoEnabled: boolean;
  templateInvite: string;
  templateTest: string;
  templateHired: string;
};

export type VerifixConfig = {
  clientId: string;
  clientSecret: string;
  filialId: string;
  apiBase: string;
  tokenPath: string;
  candidatesPath: string;
  resultsPath: string;
  trialPath: string;
  hirePath: string;
  statusMapping: string;
  transferCandidates: boolean;
  transferTestResults: boolean;
  confirmTrial: boolean;
  hireEmployee: boolean;
};

export type BitrixConfig = {
  domain: string;
  webhook: string;
  autoCreateLearningTasks: boolean;
  syncUsers: boolean;
  syncDepartments: boolean;
  syncTasks: boolean;
  syncCalendar: boolean;
  syncReports: boolean;
};

export type SmtpConfig = {
  host: string;
  port: string;
  user: string;
  password: string;
  from: string;
  secure: boolean;
  templateInvite: string;
  templateReset: string;
};

export type StorageConfig = {
  onedriveClientId: string;
  onedriveClientSecret: string;
  onedriveTenant: string;
  localPath: string;
  employeeFoldersEnabled: boolean;
};

export type IntegrationConfigMap = {
  telegram: TelegramConfig;
  verifix: VerifixConfig;
  bitrix: BitrixConfig;
  smtp: SmtpConfig;
  storage: StorageConfig;
};

export const DEFAULT_TELEGRAM_INVITE = `Здравствуйте, {name}!
Приглашаем на собеседование.
Дата: {date}
Время: {time}
{address}
{geo}
{hr}
Документы: паспорт, резюме.
{comment}

Ответьте кнопкой: «Подтверждаю» · «Не смогу прийти» · «Перенести»`;

export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfigMap = {
  telegram: {
    token: "",
    webhookSecret: "",
    notifyInterviews: true,
    notifyTests: false,
    notifyHiring: false,
    formsEnabled: true,
    geoEnabled: true,
    templateInvite: DEFAULT_TELEGRAM_INVITE,
    templateTest: `{name}, вам назначен входной тест по вакансии {vacancy}.`,
    templateHired: `{name}, поздравляем! Вы приняты в AKELA GROUP.`,
  },
  verifix: {
    clientId: "",
    clientSecret: "",
    filialId: "",
    apiBase: "",
    tokenPath: "/oauth/token",
    candidatesPath: "/candidates",
    resultsPath: "/test-results",
    trialPath: "/trial",
    hirePath: "/employees",
    statusMapping: JSON.stringify(
      {
        new: "new",
        invited: "invited",
        test_completed: "tested",
        trial_admitted: "trial",
        hired: "hired",
        rejected: "rejected",
      },
      null,
      2,
    ),
    transferCandidates: true,
    transferTestResults: true,
    confirmTrial: true,
    hireEmployee: true,
  },
  bitrix: {
    domain: "",
    webhook: "",
    autoCreateLearningTasks: false,
    syncUsers: false,
    syncDepartments: false,
    syncTasks: false,
    syncCalendar: false,
    syncReports: false,
  },
  smtp: {
    host: "",
    port: "587",
    user: "",
    password: "",
    from: "",
    secure: false,
    templateInvite: "Приглашение на собеседование: {date} {time}",
    templateReset: "Ваш новый пароль: {password}",
  },
  storage: {
    onedriveClientId: "",
    onedriveClientSecret: "",
    onedriveTenant: "",
    localPath: "",
    employeeFoldersEnabled: false,
  },
};

const SECRET_KEYS = new Set([
  "token",
  "webhookSecret",
  "clientSecret",
  "webhook",
  "password",
  "onedriveClientSecret",
]);

export function mergeIntegrationConfig<K extends IntegrationSystem>(
  system: K,
  stored: Record<string, unknown> | null | undefined,
): IntegrationConfigMap[K] {
  const defaults = DEFAULT_INTEGRATION_CONFIG[system];
  const merged = { ...defaults, ...(stored ?? {}) } as IntegrationConfigMap[K];
  return applyEnvOverlay(system, merged);
}

function applyEnvOverlay<K extends IntegrationSystem>(
  system: K,
  config: IntegrationConfigMap[K],
): IntegrationConfigMap[K] {
  if (system === "telegram") {
    const next = { ...(config as TelegramConfig) };
    if (!next.token) next.token = process.env.TELEGRAM_BOT_TOKEN ?? "";
    if (!next.webhookSecret) {
      next.webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
    }
    return next as IntegrationConfigMap[K];
  }
  if (system === "verifix") {
    const next = { ...(config as VerifixConfig) };
    if (!next.clientId) next.clientId = process.env.VERIFIX_CLIENT_ID ?? "";
    if (!next.clientSecret) {
      next.clientSecret = process.env.VERIFIX_CLIENT_SECRET ?? "";
    }
    if (!next.filialId) next.filialId = process.env.VERIFIX_FILIAL_ID ?? "";
    if (!next.apiBase) next.apiBase = process.env.VERIFIX_API_URL ?? "";
    return next as IntegrationConfigMap[K];
  }
  if (system === "bitrix") {
    const next = { ...(config as BitrixConfig) };
    if (!next.webhook) next.webhook = process.env.BITRIX_WEBHOOK_URL ?? "";
    if (!next.domain) next.domain = process.env.BITRIX_DOMAIN ?? "";
    return next as IntegrationConfigMap[K];
  }
  if (system === "smtp") {
    const next = { ...(config as SmtpConfig) };
    if (!next.host) next.host = process.env.SMTP_HOST ?? "";
    if (!next.port || next.port === "587") {
      next.port = process.env.SMTP_PORT || next.port;
    }
    if (!next.user) next.user = process.env.SMTP_USER ?? "";
    if (!next.password) next.password = process.env.SMTP_PASSWORD ?? "";
    if (!next.from) next.from = process.env.SMTP_FROM ?? "";
    return next as IntegrationConfigMap[K];
  }
  return config;
}

export function maskIntegrationConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (SECRET_KEYS.has(key) && typeof value === "string" && value) {
      out[`${key}Set`] = true;
      out[key] = "";
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function applySecretPreserves(
  incoming: Record<string, unknown>,
  stored: Record<string, unknown>,
) {
  const next = { ...incoming };
  for (const key of SECRET_KEYS) {
    const value = next[key];
    if (typeof value !== "string" || !value.trim()) {
      if (typeof stored[key] === "string") next[key] = stored[key];
    }
  }
  return next;
}

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    return vars[key] ?? "";
  });
}

export type IntegrationStatus = {
  system: IntegrationSystem;
  configured: boolean;
  connected: boolean;
  label: string;
};

export function storageEnvStatus() {
  const drive = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_DRIVE_FOLDER_ID,
  );
  const sheets = Boolean(
    process.env.GOOGLE_SHEETS_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );
  const blob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const local = Boolean(process.env.LOCAL_STORAGE_ROOT?.trim());
  return { drive, sheets, blob, local };
}
