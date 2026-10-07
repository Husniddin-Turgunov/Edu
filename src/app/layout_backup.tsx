import './globals.css';

export const metadata = {
  title: 'AKELA GROUP — Tanishtiruv platformasi',
  description: 'Yangi xodimlar uchun korporativ tanishtiruv va o\'quv platformasi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
