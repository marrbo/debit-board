// components/ThemeSync.tsx
"use client";

import { useLayoutEffect } from "react";
import { useColorScheme } from "@mui/material/styles";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";

/**
 * Sincroniza o modo do MUI com o tema resolvido (local-settings + matchMedia).
 *
 * Contrato:
 * - NÃO escreve em documentElement.classList — quem faz isso é o MUI
 *   via cssVariables.colorSchemeSelector: 'class'.
 * - Só chama setMode quando o valor difere do modo atual.
 * - useLayoutEffect garante a aplicação antes do paint (sem flicker).
 */
export function ThemeSync() {
  const resolvedTheme = useResolvedTheme();
  const { mode, setMode } = useColorScheme();

  useLayoutEffect(() => {
    if (mode === resolvedTheme) return;
    setMode(resolvedTheme);
  }, [mode, resolvedTheme, setMode]);

  return null;
}