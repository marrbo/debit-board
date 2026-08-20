/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        apple: {
          // Fundos de tela
          'bg-light': '#F5F5F7',
          'bg-dark': '#000000',

          // Superfícies e Cartões
          'card-light': '#FFFFFF',
          'card-dark': '#1C1C1E',

          // Bordas
          'border-light': '#D1D1D6',
          'border-dark': '#38383A',

          // Textos (Labels)
          'label-light': '#1C1C1E',
          'label-dark': '#F5F5F7',
          'secondary-light': '#3A3A3C',
          'secondary-dark': '#98989D',
          'tertiary-light': '#8E8E93',
          'tertiary-dark': '#636366',

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
    require('@tailwindcss/typography'),
  ],
}