// app/layout.tsx
import type { Metadata } from "next";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import "./globals.css";
import { Providers } from "./providers";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "DebitBoard",
  description: "SAST & Observabilidade",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-surface dark:bg-surface flex flex-col transition-all">
        {/* Aplica a classe .dark/.light ANTES da hidratação, sem flicker */}
        <InitColorSchemeScript attribute="class" />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
