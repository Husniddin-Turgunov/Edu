import "server-only";
import { google } from "googleapis";

/**
 * Google Drive folder sync for Excel tests and Word lessons.
 *
 * Env:
 *  GOOGLE_SERVICE_ACCOUNT_EMAIL
 *  GOOGLE_PRIVATE_KEY  (with \n newlines)
 *  GOOGLE_DRIVE_FOLDER_ID  (Excel tests; also lessons fallback)
 *  GOOGLE_DRIVE_LESSONS_FOLDER_ID  (optional Word lessons folder)
 */

export type DriveFile = {
  id: string;
  name: string;
  modifiedTime: string;
  mimeType: string;
};

/** @deprecated use DriveFile */
export type DriveExcelFile = DriveFile;

export function isDriveConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_DRIVE_FOLDER_ID,
  );
}

export function isDriveLessonsConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      (process.env.GOOGLE_DRIVE_LESSONS_FOLDER_ID ||
        process.env.GOOGLE_DRIVE_FOLDER_ID),
  );
}

function lessonsFolderId() {
  return (
    process.env.GOOGLE_DRIVE_LESSONS_FOLDER_ID ||
    process.env.GOOGLE_DRIVE_FOLDER_ID ||
    ""
  );
}

function privateKey() {
  return String(process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
}

function driveClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey(),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

const EXCEL_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.google-apps.spreadsheet",
]);

const WORD_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.google-apps.document",
]);

function looksLikeExcel(name: string, mimeType: string) {
  if (EXCEL_MIME.has(mimeType)) return true;
  return /\.(xlsx|xls)$/i.test(name);
}

function looksLikeWord(name: string, mimeType: string) {
  if (WORD_MIME.has(mimeType)) return true;
  return /\.(docx|doc)$/i.test(name);
}

async function listDriveFilesInFolder(
  folderId: string,
  predicate: (name: string, mimeType: string) => boolean,
): Promise<DriveFile[]> {
  const drive = driveClient();
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime)",
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    for (const f of res.data.files ?? []) {
      if (!f.id || !f.name || !f.mimeType) continue;
      if (!predicate(f.name, f.mimeType)) continue;
      files.push({
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime || new Date(0).toISOString(),
        mimeType: f.mimeType,
      });
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return files;
}

/** List Excel / Sheets files in the configured tests folder (non-recursive). */
export async function listDriveExcelFiles(): Promise<DriveFile[]> {
  if (!isDriveConfigured()) return [];
  return listDriveFilesInFolder(
    process.env.GOOGLE_DRIVE_FOLDER_ID!,
    looksLikeExcel,
  );
}

/** List Word / Google Docs in the lessons folder (or tests folder fallback). */
export async function listDriveWordFiles(): Promise<DriveFile[]> {
  if (!isDriveLessonsConfigured()) return [];
  return listDriveFilesInFolder(lessonsFolderId(), looksLikeWord);
}

/** List Excel / Sheets that may contain lesson plans in the lessons folder. */
export async function listDriveLessonExcelFiles(): Promise<DriveFile[]> {
  if (!isDriveLessonsConfigured()) return [];
  return listDriveFilesInFolder(lessonsFolderId(), looksLikeExcel);
}

/** Word docs + Excel plans from the lessons Drive folder. */
export async function listDriveLessonSourceFiles(): Promise<DriveFile[]> {
  if (!isDriveLessonsConfigured()) return [];
  const [word, excel] = await Promise.all([
    listDriveWordFiles(),
    listDriveLessonExcelFiles(),
  ]);
  const byId = new Map<string, DriveFile>();
  for (const file of [...word, ...excel]) byId.set(file.id, file);
  return [...byId.values()];
}

/** Download file bytes; Sheets→xlsx, Docs→docx. */
export async function downloadDriveFile(file: DriveFile): Promise<Buffer> {
  if (!isDriveConfigured() && !isDriveLessonsConfigured()) {
    throw new Error("Google Drive is not configured");
  }

  const drive = driveClient();

  if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
    const res = await drive.files.export(
      {
        fileId: file.id,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      { responseType: "arraybuffer" },
    );
    return Buffer.from(res.data as ArrayBuffer);
  }

  if (file.mimeType === "application/vnd.google-apps.document") {
    const res = await drive.files.export(
      {
        fileId: file.id,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      { responseType: "arraybuffer" },
    );
    return Buffer.from(res.data as ArrayBuffer);
  }

  const res = await drive.files.get(
    { fileId: file.id, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}
