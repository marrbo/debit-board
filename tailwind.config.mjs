/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography'

module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // 'class' garante compatibilidade com o alternador de dark mode do MUI (usando a classe .dark)
  darkMode: 'class', 
  theme: {
    extend: {
      colors: {
        // 🔹 Integração nativa com MUI Theme (utilizando CSS Variables do MUI v5+)
        mui: {
          primary: {
            main: 'var(--mui-palette-primary-main, #1976d2)',
            light: 'var(--mui-palette-primary-light, #42a5f5)',
            dark: 'var(--mui-palette-primary-dark, #1565c0)',
            contrast: 'var(--mui-palette-primary-contrastText, #fff)',
          },
          secondary: {
            main: 'var(--mui-palette-secondary-main, #9c27b0)',
            light: 'var(--mui-palette-secondary-light, #ba68c8)',
            dark: 'var(--mui-palette-secondary-dark, #7b1fa2)',
          },
          text: {
            primary: 'var(--mui-palette-text-primary, rgba(0, 0, 0, 0.87))',
            secondary: 'var(--mui-palette-text-secondary, rgba(0, 0, 0, 0.6))',
            disabled: 'var(--mui-palette-text-disabled, rgba(0, 0, 0, 0.38))',
          },
          background: {
            default: 'var(--mui-palette-background-default, #fff)',
            paper: 'var(--mui-palette-background-paper, #fff)',
          },
          divider: 'var(--mui-palette-divider, rgba(0, 0, 0, 0.12))',
        },

        // 🍏 Suas cores personalizadas do estilo Apple (Mantidas)
        apple: {
          // Fundos de tela
          'bg-light': '#F5F5F7',
          'bg-dark': '#111111',

          // Superfícies e Cartões
          'card-light': '#FFFFFF',
          'card-dark': '#1D1D1D',

          // Bordas
          'border-light': '#D1D1D6',
          'border-dark': '#2D2D2D',

          // Textos (Labels)
          'label-light': '#1C1C1E',
          'label-dark': '#E8E8E8',
          'secondary-light': '#3A3A3C',
          'secondary-dark': '#9A9A9A',
          'tertiary-light': '#8E8E93',
          'tertiary-dark': '#707070',

          // Cores de Ação e Destaque
          'blue': '#007AFF',
          'green': '#34C759',
          'red': '#FF3B30',
          'orange': '#FF9500',
          'yellow': '#FFCC00',
        },
      },
    },
  },
  plugins: [
    typography
  ],
}
