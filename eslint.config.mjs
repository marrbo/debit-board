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
      // 1. O problema do 'any': alertar em vez de travar o build.
      "@typescript-eslint/no-explicit-any": "warn",

      // 2. Controle total de imports e variáveis não utilizadas via plugin.

      // 3. Melhora a legibilidade: exige que type/interface seja importado explicitamente como type.
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports" },
      ],
    },
  },

  // Ignores globais consolidados
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),
]);

export default eslintConfig;