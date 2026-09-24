// app/layout.tsx
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { authOptions } from "@/lib/auth-options";
import "./globals.css";
import { Providers } from "./providers";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "DebitBoard",
  description: "SAST & Observabilidade",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-page flex flex-col transition-all">
        <InitColorSchemeScript attribute="class" />
        <Providers session={session}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
