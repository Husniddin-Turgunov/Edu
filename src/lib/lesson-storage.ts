// In-memory storage for lessons (in production, replace with database)
export type Lesson = {
  id: string;
  title: string;
  content: string;
  types: string[];
  module?: string;
  order?: number;
  createdAt: string;
  updatedAt: string;
};

// Sample initial lessons
const initialLessons: Lesson[] = [
  {
    id: "1",
    title: "Kompaniya tarixi",
    content: `# Kompaniya tarixi

## Asos solinish
AKELA GROUP MACHINERY 2004-yilda tashkil etilgan.

## Rivojlanish
Kompaniya asta-sekin rivojlanib, hozirgi kungacha yetib keldi.`,
    types: ["lesson"],
    module: "Kompaniya haqida",
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2", 
    title: "Qadriyatlar",
    content: `# Qadriyatlar

## Halollik
Biz har qanday vaziyatda rostgo'y bo'lamiz.

## Mas'uliyat
Har birimiz o'z ishimiz natijasi uchun javobgarmiz.`,
    types: ["lesson"],
    module: "Madaniyat",
    order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let lessons: Lesson[] = [...initialLessons];

export const lessonStorage = {
  getAll: () => lessons,
  
  getById: (id: string) => lessons.find((l) => l.id === id),
  
  create: (lesson: Omit<Lesson, "id" | "createdAt" | "updatedAt">) => {
    const newLesson: Lesson = {
      ...lesson,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    lessons.push(newLesson);
    return newLesson;
  },
  
  update: (id: string, updates: Partial<Omit<Lesson, "id" | "createdAt" | "updatedAt">>) => {
    const index = lessons.findIndex((l) => l.id === id);
    if (index === -1) return null;
    
    lessons[index] = {
      ...lessons[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return lessons[index];
  },
  
  delete: (id: string) => {
    const index = lessons.findIndex((l) => l.id === id);
    if (index === -1) return false;
    
    lessons.splice(index, 1);
    return true;
  },
  
  search: (query: string) => {
    const q = query.toLowerCase();
    return lessons.filter((l) => 
      l.title.toLowerCase().includes(q) || 
      l.content.toLowerCase().includes(q)
    );
  },
  
  filterByType: (type: string) => {
    return lessons.filter((l) => l.types.includes(type));
  },
  
  filterByModule: (module: string) => {
    return lessons.filter((l) => l.module === module);
  },
};