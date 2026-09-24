'use client';

import { Experimental_CssVarsProvider as CssVarsProvider, extendTheme } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import CssBaseline from '@mui/material/CssBaseline';

const theme = extendTheme({
  // Usa a classe '.dark' em vez do atributo data-mui-color-scheme
  colorSchemeSelector: 'class',
  // Define explicitamente as cores para light e dark – isso gera as variáveis CSS
  colorSchemes: {
    light: {
      palette: {
        text: {
          primary: '#1C1C1E',   // cor escura para texto no light
          secondary: '#6B7280',
          disabled: '#9CA3AF',
        },
        divider: 'rgba(0,0,0,0.12)',
        background: {
          default: '#F5F5F7',
          paper: '#FFFFFF',
        },
      },
    },
    dark: {
      palette: {
        text: {
          primary: '#E8E8E8',   // cor clara para texto no dark
          secondary: '#9A9A9A',
          disabled: '#6B7280',
        },
        divider: 'rgba(255,255,255,0.12)',
        background: {
          default: '#111111',
          paper: '#1D1D1D',
        },
      },
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <CssVarsProvider theme={theme} defaultMode="light" modeStorageKey="wiki-theme">
        <CssBaseline />
        {children}
      </CssVarsProvider>
    </AppRouterCacheProvider>
  );
}