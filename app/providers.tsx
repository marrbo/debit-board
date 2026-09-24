// app/providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeSync } from "@/components/ThemeSync";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import { ConfirmProvider } from "@/hooks/useConfirm";

const theme = createTheme({
  colorSchemes: { light: true, dark: true },
  cssVariables: { colorSchemeSelector: "class" },
});

interface ProvidersProps {
  children: React.ReactNode;
  session: Session | null;
}

export function Providers({ children, session }: ProvidersProps) {
  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ThemeProvider theme={theme} defaultMode="system">
        <ThemeSync />
        <CssBaseline enableColorScheme />
        <FeedbackProvider>
          <SessionProvider session={session}>
            <ConfirmProvider>{children}</ConfirmProvider>
          </SessionProvider>
        </FeedbackProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
