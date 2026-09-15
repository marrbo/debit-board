// app/providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeSync } from "@/components/ThemeSync";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";

const theme = createTheme({
  colorSchemes: { light: true, dark: true },
  cssVariables: { colorSchemeSelector: "class" },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ThemeProvider theme={theme} defaultMode="system">
        <ThemeSync />
        <CssBaseline enableColorScheme />
        <FeedbackProvider>
          <SessionProvider>{children}</SessionProvider>
        </FeedbackProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}