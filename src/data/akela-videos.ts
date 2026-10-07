// Video darslar ma'lumotlari
export interface VideoLesson {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  size: string;
  url: string;
  poster?: string;
}

export const VIDEO_LESSONS: VideoLesson[] = [
  {
    id: "5ae75153-acf8-4662-8e4e-7dd8641fa7f3",
    title: "BitRix24 boshlang'ich darslik",
    description: "Bu darsda siz AKELA GROUP korxonasida kunlik bitrix bilan ishlashni ko'rasizlar. CRM, vazifalar, taqvim va hujjatlar bilan tanishish.",
    category: "Tizim",
    duration: "07:42",
    size: "495 MB",
    url: "https://pub-d80cbd7c69b44251bff214a8cb06725c.r2.dev/3f4a1ae0-2faf-4c5d-92f4-8ab2c91cedc8/master.m3u8",
  },
];

export const VIDEO_CATEGORIES = ["Hammasi", "Tizim", "Onboarding", "Mahorat", "Xavfsizlik"];
