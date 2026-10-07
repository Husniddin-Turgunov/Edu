-- ============================================================================
-- 2026-09-24 — Matn/JSON ustunlarini kengaytirish (varchar(191) → TEXT)
-- ============================================================================
-- SABAB: Prisma'da `String` MySQL/MariaDB uchun `VARCHAR(191)` ga aylanadi.
-- 191 belgidan uzun qiymat bazaga yozilganda MariaDB uni JIMGINA kesib
-- tashlaydi (xato bermaydi). Natijada:
--   * TestResult.answers (javoblar JSON i) — kesilgan JSON parse bo'lmay,
--     test natijasini ko'rishda tanlangan/noto'g'ri javoblar ko'rinmasdi
--     (faqat yashil "To'g'ri" belgilari chiqardi).
--   * JobDay.content — kasbiy kurs darslari matni 191 belgida qirqilgan.
--   * Question.text / Choice.text / JobDay.title va h.k.
--
-- Bu ALTER lar faqat KENGAYTIRADI (data yo'qolmaydi). Ilgari kesilgan
-- qiymatlarni qaytarib bo'lmaydi (ular bazaga yozilmagan), lekin yangi
-- yozuvlar to'liq saqlanadi.
--
-- Ishlatish:  mysql -u USER -p DBNAME < 20260924-widen-text-columns.sql
-- (yoki `npm run db:push` — bu fayl bilan bir xil o'zgarishni beradi)
-- ============================================================================

ALTER TABLE `Choice`       MODIFY `text` TEXT NOT NULL;
ALTER TABLE `Course`       MODIFY `title` TEXT NOT NULL, MODIFY `description` TEXT NULL;
ALTER TABLE `JobCourse`    MODIFY `title` TEXT NOT NULL;
ALTER TABLE `JobDay`       MODIFY `title` TEXT NOT NULL,
                           MODIFY `content` LONGTEXT NOT NULL DEFAULT '',
                           MODIFY `videoUrl` TEXT NOT NULL DEFAULT '';
ALTER TABLE `JobPart`      MODIFY `title` TEXT NOT NULL;
ALTER TABLE `JobTestResult` MODIFY `answers` TEXT NOT NULL DEFAULT '{}';
ALTER TABLE `Lesson`       MODIFY `title` TEXT NOT NULL,
                           MODIFY `videoUrl` TEXT NULL,
                           MODIFY `pdfUrl` TEXT NULL;
ALTER TABLE `Module`       MODIFY `title` TEXT NOT NULL, MODIFY `description` TEXT NULL;
ALTER TABLE `Post`         MODIFY `title` TEXT NOT NULL, MODIFY `content` TEXT NULL;
ALTER TABLE `Question`     MODIFY `text` TEXT NOT NULL,
                           MODIFY `explanation` TEXT NULL,
                           MODIFY `correctAnswer` TEXT NULL;
ALTER TABLE `Test`         MODIFY `title` TEXT NOT NULL,
                           MODIFY `description` TEXT NULL,
                           MODIFY `assignedUserIds` TEXT NOT NULL DEFAULT '[]';
ALTER TABLE `TestResult`   MODIFY `answers` TEXT NOT NULL DEFAULT '{}';
ALTER TABLE `Video`        MODIFY `title` TEXT NOT NULL,
                           MODIFY `description` TEXT NOT NULL DEFAULT '',
                           MODIFY `url` TEXT NOT NULL,
                           MODIFY `poster` TEXT NULL;
