import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  
  // ============================================================================
  // CUSTOM RULES (Alinhamento com tsconfig e produtividade)
  // ============================================================================
  {
    rules: {
      // 1. O problema do 'any': mudamos de 'error' para 'warn'.
      // Isso avisa que o 'any' é ruim, mas não trava o build do seu projeto.
      "@typescript-eslint/no-explicit-any": "warn",

      // 2. Alinhamento com 'noUnusedLocals' e 'noUnusedParameters' do tsconfig.
      // Colocamos como 'warn' para não interromper o fluxo de desenvolvimento
      // enquanto você está criando variáveis que ainda não usou.
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_", 
        "varsIgnorePattern": "^_" 
      }],

      // 3. Melhora a legibilidade: exige que a interface/tipo seja consistente
      "@typescript-eslint/consistent-type-imports": ["warn", { 
        "prefer": "type-imports" 
      }],
    }
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]
  }
]);

export default eslintConfig;
