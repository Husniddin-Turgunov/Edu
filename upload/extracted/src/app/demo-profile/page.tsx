"use client";

import { KnowledgeProfileCard } from "@/components/KnowledgeProfileCard";
import { analyzeKnowledgeProfile, type ScorableQuestion } from "@/lib/scoring";

/** Пример результата в формате вашего HR-теста: 5 блоков, тест + открытые */
function mc(
  id: number,
  section: string,
  prompt: string,
  correctIndex: number,
): ScorableQuestion {
  return {
    id,
    prompt,
    type: "single",
    correctIndex,
    correctIndexesJson: `[${correctIndex}]`,
    keywordsJson: "[]",
    optionsJson: "[]",
    weight: 1,
    section,
    knowledgeKind: "knowledge",
  };
}

function openQ(id: number, section: string, prompt: string): ScorableQuestion {
  return {
    id,
    prompt,
    type: "text",
    correctIndex: 0,
    correctIndexesJson: "[]",
    keywordsJson: "[]",
    optionsJson: "[]",
    weight: 0,
    section,
    knowledgeKind: "knowledge",
  };
}

const B1 = "1. Открытие вакансии и определение требований";
const B2 = "2. Поиск и привлечение кандидатов";
const B3 = "3. Отбор и собеседование (скрининг)";
const B4 = "4. Коммуникация с кандидатом и оффер";
const B5 = "5. Завершение найма и передача сотрудника";

const DEMO_QUESTIONS: ScorableQuestion[] = [
  mc(1, B1, "С кем говорить перед открытием вакансии?", 1),
  mc(2, B1, "Что такое профиль кандидата?", 1),
  mc(3, B1, "Что не обязательно в тексте вакансии?", 2),
  mc(4, B1, "Внутренний vs внешний поиск?", 0),
  mc(5, B1, "Цель брифа с заказчиком?", 1),
  openQ(6, B1, "3 вопроса руководителю при уточнении требований?"),
  openQ(7, B1, "Руководитель говорит «нужен хороший сотрудник» — что делать?"),

  mc(11, B2, "Источники сорсинга?", 1),
  mc(12, B2, "Пассивный кандидат — это?", 0),
  mc(13, B2, "Мало откликов — что проверить?", 1),
  mc(14, B2, "Boolean-поиск для чего?", 1),
  mc(15, B2, "Employer branding для чего?", 1),
  openQ(16, B2, "Как искать редкого специалиста?"),

  mc(21, B3, "Длительность телефонного скрининга?", 1),
  mc(22, B3, "Метод STAR для чего?", 1),
  mc(23, B3, "Buzzwords в резюме означают?", 1),
  mc(24, B3, "Запрещённая тема на интервью?", 1),
  mc(25, B3, "Два сильных кандидата — на что смотреть?", 1),
  openQ(27, B3, "Слабые hard skills + мотивация vs сильные hard skills + холод?"),

  mc(31, B4, "Как сообщать об отказе?", 1),
  mc(32, B4, "Главное в оффере?", 1),
  mc(33, B4, "Два оффера у кандидата — что делать?", 1),
  mc(34, B4, "После принятия оффера?", 1),
  mc(35, B4, "Зарплата выше бюджета — первый шаг?", 1),
  openQ(36, B4, "Как снизить ghosting после оффера?"),

  mc(41, B5, "Задача рекрутера на оформлении?", 0),
  mc(42, B5, "До первого рабочего дня?", 1),
  mc(43, B5, "Time to hire — это?", 1),
  mc(44, B5, "Уход на испытательном — показатель?", 1),
  mc(45, B5, "Важный итоговый показатель?", 1),
  openQ(48, B5, "По каким метрикам оценить свою работу?"),
];

/** Сильный блок 1–2, слабый скрининг, средний оффер/закрытие */
const DEMO_ANSWERS: Record<string, number | string> = {
  "1": 1,
  "2": 1,
  "3": 2,
  "4": 0,
  "5": 1,
  "6": "Какие KPI? Какой бюджет? Кого уже пробовали нанимать?",
  "7": "Уточню через бриф: задачи, must-have, вилку ЗП.",
  "11": 1,
  "12": 0,
  "13": 1,
  "14": 1,
  "15": 0, // wrong
  "16": "Хантя через LinkedIn, рекомендации, сообщества.",
  "21": 0, // wrong
  "22": 1,
  "23": 0, // wrong
  "24": 1,
  "25": 0, // wrong
  "27": "Смотрю на роль: для роста возьму мотивацию, для срочного закрытия — hard skills.",
  "31": 1,
  "32": 1,
  "33": 1,
  "34": 0, // wrong
  "35": 1,
  "36": "Держу контакт, фиксирую оффер письменно, короткий follow-up.",
  "41": 0,
  "42": 1,
  "43": 1,
  "44": 1,
  "45": 1,
  "48": "Time to hire, quality of hire, early turnover.",
};

export default function DemoProfilePage() {
  const profile = analyzeKnowledgeProfile(DEMO_QUESTIONS, DEMO_ANSWERS);

  return (
    <main className="main" style={{ maxWidth: 820, margin: "40px auto", padding: 16 }}>
      <p className="eyebrow">Локальный пример результата</p>
      <h1>После теста HR-рекрутера</h1>
      <p className="lead">
        Тестовые вопросы считают автобалл по блокам. Открытые ответы не штрафуют
        процент — их читает HR в разборе.
      </p>

      <section className="panel result-panel" style={{ marginTop: 20 }}>
        <p className="eyebrow">Результат</p>
        <h2>Алишер Каримов: {profile.overallScore}%</h2>
        <KnowledgeProfileCard profile={profile} />
      </section>
    </main>
  );
}
