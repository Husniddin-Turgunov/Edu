-- AlterTable
ALTER TABLE `Choice` MODIFY `text` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `Course` MODIFY `title` TEXT NOT NULL,
    MODIFY `description` TEXT NULL;

-- AlterTable
ALTER TABLE `JobCourse` MODIFY `title` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `JobDay` MODIFY `title` TEXT NOT NULL,
    MODIFY `content` LONGTEXT NOT NULL DEFAULT '',
    MODIFY `videoUrl` TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `JobPart` MODIFY `title` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `JobTestResult` MODIFY `answers` TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE `Lesson` MODIFY `title` TEXT NOT NULL,
    MODIFY `videoUrl` TEXT NULL,
    MODIFY `pdfUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `Module` MODIFY `title` TEXT NOT NULL,
    MODIFY `description` TEXT NULL;

-- AlterTable
ALTER TABLE `Post` MODIFY `title` TEXT NOT NULL,
    MODIFY `content` TEXT NULL;

-- AlterTable
ALTER TABLE `Question` MODIFY `text` TEXT NOT NULL,
    MODIFY `explanation` TEXT NULL,
    MODIFY `correctAnswer` TEXT NULL;

-- AlterTable
ALTER TABLE `Test` MODIFY `title` TEXT NOT NULL,
    MODIFY `description` TEXT NULL,
    MODIFY `assignedUserIds` TEXT NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE `TestResult` MODIFY `answers` TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE `Video` MODIFY `title` TEXT NOT NULL,
    MODIFY `description` TEXT NOT NULL DEFAULT '',
    MODIFY `url` TEXT NOT NULL,
    MODIFY `poster` TEXT NULL;

