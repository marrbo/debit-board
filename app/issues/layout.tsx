// app/issues/layout.tsx
import Sidebar from '@/components/Sidebar';

export default function IssuesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors duration-200">
      {/* Barra Lateral */}
      <Sidebar />

      {/* Conteúdo Principal */}
      <main className="flex-1 p-8">
        <div className="w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}