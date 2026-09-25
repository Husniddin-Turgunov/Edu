import "server-only";
import {
  downloadDriveFile,
  isDriveConfigured,
  isDriveLessonsConfigured,
  listDriveExcelFiles,
  listDriveLessonSourceFiles,
  type DriveFile,
} from "@/lib/google-drive";
import {
  isLocalStorageConfigured,
  listLocalExcelFiles,
  listLocalLessonSourceFiles,
  readLocalFileById,
} from "@/lib/local-storage";

export type ContentSource = "local" | "drive";

export async function getContentSource(): Promise<ContentSource | null> {
  if (await isLocalStorageConfigured()) return "local";
  if (isDriveConfigured() || isDriveLessonsConfigured()) return "drive";
  return null;
}

export async function isContentStorageConfigured() {
  return Boolean(await getContentSource());
}

export async function isLessonsContentConfigured() {
  if (await isLocalStorageConfigured()) return true;
  return isDriveLessonsConfigured();
}

export async function contentStorageLabel() {
  const source = await getContentSource();
  if (source === "local") return "локального диска";
  if (source === "drive") return "Google Drive";
  return "хранилища";
}

export async function listContentExcelFiles(): Promise<DriveFile[]> {
  if (await isLocalStorageConfigured()) {
    return listLocalExcelFiles("tests");
  }
  return listDriveExcelFiles();
}

export async function listContentAttestationExcelFiles(): Promise<DriveFile[]> {
  if (await isLocalStorageConfigured()) {
    return listLocalExcelFiles("attestations");
  }
  return listDriveExcelFiles();
}

export async function listContentLessonSourceFiles(): Promise<DriveFile[]> {
  if (await isLocalStorageConfigured()) {
    return listLocalLessonSourceFiles();
  }
  return listDriveLessonSourceFiles();
}

export async function downloadContentFile(file: DriveFile): Promise<Buffer> {
  if (file.id.startsWith("local::")) {
    return readLocalFileById(file.id);
  }
  return downloadDriveFile(file);
}

export async function contentStorageNotConfiguredMessage(scope: "tests" | "lessons") {
  if (scope === "lessons") {
    return (
      "Хранилище не настроено. Укажите LOCAL_STORAGE_ROOT (или путь в Интеграции → Хранилище) " +
      "и положите Word/Excel в папку lessons/, либо настройте Google Drive."
    );
  }
  return (
    "Хранилище не настроено. Укажите LOCAL_STORAGE_ROOT (или путь в Интеграции → Хранилище) " +
    "и положите Excel в папку tests/, либо настройте Google Drive."
  );
}
