Para configurar o **Vitest** no seu projeto Next.js (com TypeScript e React), você precisará instalar as dependências abaixo e criar um arquivo de configuração.

---

## 📦 Pacotes necessários

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @testing-library/dom
```

Se você estiver usando `npm`, use o comando acima. Se preferir `yarn` ou `pnpm`, adapte.

**Explicação de cada pacote:**
- `vitest` – o próprio framework de testes (usa o Vite internamente).
- `@vitejs/plugin-react` – suporte para transformar JSX/TSX no Vite.
- `@testing-library/react` – renderiza componentes React para testes.
- `@testing-library/jest-dom` – matchers extras (ex.: `toBeInTheDocument()`).
- `@testing-library/user-event` – simula eventos de usuário de forma realista.
- `jsdom` – simula um ambiente de navegador para os testes.
- `@testing-library/dom` – dependência interna do Testing Library (já instalada junto, mas é bom listar).

---

## ⚙️ Configuração do `vitest.config.ts`

Na raiz do projeto, crie o arquivo **`vitest.config.ts`** com o seguinte conteúdo:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,          // permite usar describe/it/expect sem importar
    setupFiles: './setupTests.ts',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),  // para importar com '@'
    },
  },
});
```

### 🧪 Arquivo de setup (opcional, mas recomendado)

Crie **`setupTests.ts`** na raiz:

```ts
import '@testing-library/jest-dom/vitest';
```

Esse arquivo registra os matchers do jest-dom.

---

## 🔧 Ajustes para o seu caso específico

No seu teste (`page.test.tsx`) você está mockando:
- `next/navigation` → useRouter
- `next-auth/react` → useSession
- `@/components/dbql/DBQLAdvancedSearch`
- `@/components/PageHeader`
- `@/components/AssigneeSelect`
- `exceljs`
- `react-to-print`

Esses mocks já estão no teste, então você não precisa de nada extra além das dependências acima.

**Dica:** Se você estiver usando o `next/navigation` e o `next-auth/react` em vários testes, pode criar mocks globais em `setupTests.ts` para evitar repetição. Porém, o nosso exemplo já coloca os mocks dentro do arquivo de teste com `vi.mock`, o que é válido.

---

## 🚀 Rodando os testes

Adicione no seu `package.json`:

```json
"scripts": {
  "test": "vitest",
  "test:watch": "vitest --watch",
  "test:coverage": "vitest run --coverage"
}
```

Para gerar relatório de cobertura, instale também:

```bash
npm install -D @vitest/coverage-v8
```

E então execute `npm run test:coverage`.

---

## ✅ Verificação final

Antes de rodar, certifique-se de que seu arquivo de teste está no lugar certo (por exemplo, `app/observations/page.test.tsx`). Execute:

```bash
npm run test
```

Se tudo estiver correto, os testes devem passar.

---

## 🔍 Possíveis problemas comuns

1. **Erro de importação `@/`**  
   O alias `@` deve estar configurado também no `tsconfig.json` (para o TypeScript) e no `vitest.config.ts` (para o Vite). Já configuramos no `resolve.alias` do Vitest.

2. **Falta de `jsdom`**  
   Se o ambiente `jsdom` não estiver instalado, o Vitest pode reclamar. Confirme que ele está nas dependências de desenvolvimento.

3. **Mock de módulos com `vi.mock`**  
   Certifique-se de que os mocks estão no topo do arquivo de teste (fora dos `describe`), como no exemplo que forneci.

4. **Problemas com `exceljs`**  
   No seu teste, você mockou `exceljs`. Isso é necessário porque a biblioteca usa APIs de Node que não existem no jsdom.

---

## 💡 Conclusão

Com essas dependências e a configuração acima, você conseguirá executar os testes da sua página `ObservationsPage` sem quebrar nenhuma funcionalidade. Se precisar de ajuda adicional para configurar o coverage ou para mockar outros módulos, é só avisar! 😊