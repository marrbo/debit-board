// scripts/setup-wiki.ts
import fs from 'fs';
import path from 'path';

const WIKI_ROOT = path.join(process.cwd(), 'content', 'wiki');

// Conteúdo dos arquivos Markdown com hierarquia de pastas
const files: Record<string, string> = {
  // Página Raiz
  'index.md': `# Bem-vindo à DebitBoard Wiki

Esta é a documentação oficial da plataforma DebitBoard.

## 📚 Navegação Rápida
- [Primeiros Passos](/wiki/getting-started/quick-start) - Como começar.
- [Referência DBQL](/wiki/dbql/syntax) - Linguagem de consulta.
- [Configurações de Admin](/wiki/admin/setup) - Configuração do sistema.

---

*Última atualização: ${new Date().toLocaleDateString()}*
`,

  // Pasta Getting Started
  'getting-started/quick-start.md': `# Guia Rápido de Início

## 1. Acesse o Portal
Faça login no DebitBoard com suas credenciais de Tenant.

## 2. Configure sua primeira integração
Vá em **Settings > Integrations** e adicione seu repositório Azure DevOps.

## 3. Execute uma varredura (SAST)
Crie um novo projeto e solicite uma varredura de segurança.

---

> **Dica:** Visite a [seção de Configuração](/wiki/admin/setup) para habilitar SSO.`,

  // Pasta DBQL
  'dbql/syntax.md': `# Sintaxe da DBQL

A Debit Board Query Language (DBQL) possui uma sintaxe poderosa.

## Propriedades base
- \`category\`: Categoria da vulnerabilidade.
- \`severity\`: \`critical\`, \`high\`, \`medium\`, \`low\`.

## Operadores
- \`AND\`, \`OR\`, \`NOT\` ou \`!\`
- Uso de parênteses \`( )\` para agrupamento.

## Exemplo
\`\`\`dbql
!branch:main AND (severity:high OR severity:critical)
\`\`\`
`,

  'dbql/examples.md': `# Exemplos de Consultas DBQL

\`\`\`dbql
# Buscar tudo que não esteja na branch main
!branch:main

# Buscar SQL Injection aberto
category:"SQL Injection" AND status:open
\`\`\``,

  // Pasta Admin
  'admin/setup.md': `# Configuração do Sistema (Admin)

Apenas usuários com permissão de **Tenant Admin** podem editar esta Wiki.

## Variáveis de Ambiente
\`\`\`env
KEYCLOAK_CLIENT_ID=nextjs-client
KEYCLOAK_ISSUER=https://localhost:8080/realms/debit-board
\`\`\`

## Habilitando SSO
Acesse \`/settings/security\` para configurar o Keycloak.`
};

function setupWiki() {
  // Limpa a pasta wiki se existir (opcional, para evitar arquivos antigos)
  if (fs.existsSync(WIKI_ROOT)) {
    fs.rmSync(WIKI_ROOT, { recursive: true, force: true });
    console.log(`🧹 Limpando pasta wiki antiga...`);
  }

  // Cria a raiz
  fs.mkdirSync(WIKI_ROOT, { recursive: true });

  // Cria os arquivos iterando sobre o objeto
  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(WIKI_ROOT, filename);
    // Garante que a subpasta do arquivo exista
    const dirName = path.dirname(filePath);
    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`📄 Arquivo criado: ${filePath}`);
  }

  console.log('🎉 Estrutura da Wiki configurada com sucesso!');
}

setupWiki();