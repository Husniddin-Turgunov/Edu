import {
  LESSON_CATALOG,
  ROLE_FAMILIES,
  detectRoleFamilies,
  isLevelAccessible,
  levelRank,
  type Lesson,
  type LessonLevel,
} from "@/lib/lessons";
import { lessonAssignedToStaffRole } from "@/lib/role-match";

export { isLevelAccessible };

export type VerificationQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

export type VerificationTest = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  title: string;
  summary: string;
  level: LessonLevel;
  roleFamilies: string[];
  topics: string[];
  durationMin: number;
  questions: VerificationQuestion[];
};

export function buildDefaultVerificationQuestions(lesson: {
  id: string;
  title: string;
  topics: string[];
  level: string;
}): VerificationQuestion[] {
  const topic = lesson.topics[0] ?? "теме";
  return [
    {
      id: `${lesson.id}-q1`,
      prompt: `После урока «${lesson.title}» что вы сделаете в первую очередь на практике?`,
      options: [
        "Применю материал на реальной рабочей задаче",
        "Отложу до следующего обучения",
        "Проигнорирую, если никто не проверяет",
        "Подожду отдельного приказа",
      ],
      correctIndex: 0,
    },
    {
      id: `${lesson.id}-q2`,
      prompt: `Что важнее всего проверить по теме «${topic}»?`,
      options: [
        "Понимание и правильное применение в своей должности",
        "Только запомнить формулировки для теста",
        "Скопировать чужой ответ",
        "Пропустить сложные части",
      ],
      correctIndex: 0,
    },
    {
      id: `${lesson.id}-q3`,
      prompt: `Как понять, что урок «${lesson.title}» усвоен?`,
      options: [
        "Могу объяснить коллеге и выполнить задачу без подсказок",
        "Прочитал название урока",
        "Открыл страницу обучения один раз",
        "Дождался повышения разряда без практики",
      ],
      correctIndex: 0,
    },
    {
      id: `${lesson.id}-q4`,
      prompt: "Если в тесте или на работе возникает пробел по этой теме, что делать?",
      options: [
        "Вернуться к уроку, закрыть пробел и повторить проверку",
        "Скрыть ошибку",
        "Сразу просить более высокий разряд",
        "Менять должность",
      ],
      correctIndex: 0,
    },
    {
      id: `${lesson.id}-q5`,
      prompt: `Эта проверка нужна, чтобы подтвердить навык уровня ${
        lesson.level === "all" ? "базы" : lesson.level
      }. Ваша цель:`,
      options: [
        "Показать усвоение материала обучения",
        "Пройти случайно",
        "Обойти блокировку уровней",
        "Заменить аттестацию",
      ],
      correctIndex: 0,
    },
  ];
}

function buildQuestions(lesson: Lesson): VerificationQuestion[] {
  return buildDefaultVerificationQuestions(lesson);
}

export const VERIFICATION_TEST_CATALOG: VerificationTest[] =
  LESSON_CATALOG.map((lesson) => ({
    id: `check-${lesson.id}`,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    title: `Проверка: ${lesson.title}`,
    summary: `Проверьте, что усвоили материал урока «${lesson.title}». ${lesson.summary}`,
    level: lesson.level,
    roleFamilies: lesson.roleFamilies,
    topics: lesson.topics,
    durationMin: Math.max(8, Math.round(lesson.durationMin / 2)),
    questions: buildQuestions(lesson),
  }));

export function getVerificationTestById(id: string) {
  return VERIFICATION_TEST_CATALOG.find((test) => test.id === id) ?? null;
}

export function verificationTestsForRole(
  roleTitle: string,
  catalog: VerificationTest[] = VERIFICATION_TEST_CATALOG,
) {
  return catalog.filter((test) =>
    lessonAssignedToStaffRole(test.roleFamilies, roleTitle),
  );
}

export function recommendVerificationTests(input: {
  roleTitle: string;
  currentLevel: string;
  gaps: string[];
  weakSections: string[];
  limit?: number;
  catalog?: VerificationTest[];
}): { test: VerificationTest; reasons: string[] }[] {
  const current =
    input.currentLevel === "unassessed" ? "junior" : input.currentLevel;
  const currentRank = levelRank(current);
  const gapBlob = [...input.gaps, ...input.weakSections]
    .join(" ")
    .toLowerCase();
  const catalog = input.catalog ?? VERIFICATION_TEST_CATALOG;

  return catalog
    .filter((test) =>
      lessonAssignedToStaffRole(test.roleFamilies, input.roleTitle),
    )
    .filter((test) => isLevelAccessible(test.level, current))
    .map((test) => {
      const reasons: string[] = ["проверка по вашей должности"];
      let score = 5;

      if (test.level === current) {
        score += 5;
        reasons.push("уровень совпадает с вашим");
      } else if (test.level === "all") {
        score += 2;
      } else {
        score += Math.max(0, 2 - Math.abs(levelRank(test.level) - currentRank));
        reasons.push("доступен на вашем уровне");
      }

      if (test.topics.some((topic) => gapBlob.includes(topic))) {
        score += 5;
        reasons.push("проверяет пробел из обучения");
      } else {
        reasons.push("закрепляет пройденный урок");
      }

      return { test, score, reasons };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 8)
    .map(({ test, reasons }) => ({ test, reasons }));
}

export function roleFamilyLabel(roleTitle: string) {
  const families = detectRoleFamilies(roleTitle);
  return (
    ROLE_FAMILIES.find((family) => family.id === families[0])?.label ??
    roleTitle
  );
}
