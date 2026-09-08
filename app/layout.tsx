// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'DebitBoard',
  description: 'SAST & Observabilidade',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 🔹 suppressHydrationWarning evita flashes de luz brancos ao carregar o modo escuro salvo
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-surface/80 dark:bg-surface flex flex-col">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
