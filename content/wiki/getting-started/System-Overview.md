# Visão Geral do Sistema

O **DebitBoard** é a plataforma interna de **ASPM (Application Security
Posture Management)** usada para consolidar, priorizar e acompanhar achados
de segurança de aplicação em múltiplos projetos.

Esta página apresenta as principais funcionalidades e como elas se conectam.
Para começar a usar, veja [Primeiros Passos](/wiki/getting-started/quick-start).

## O que a plataforma faz

O DebitBoard centraliza o resultado de scanners de segurança e organiza cada
achado em um modelo unificado chamado **observation**. Cada observation
carrega:

- **Categoria** — tipo da falha (ex.: "Broken Access Control", "Injeção SQL").
- **Severidade** — `critical`, `high`, `medium`, `low` ou `info`.
- **Status** — `new`, `open`, `resolved`, `recurring` ou `wont_fix`.
- **Contexto de código** — arquivo, branch, repositório e projeto.
- **Responsável** — a quem o achado foi atribuído.
- **SLA** — prazo esperado para correção, derivado do padrão de segurança.

Hoje o DebitBoard consome **SAST** por meio de integração com **Azure Search
Code**. A próxima fase do roadmap inclui integrações com **Trivy**,
**Dependency-track** e **SonarQube**, ampliando a cobertura para
vulnerabilidades em containers, dependências e qualidade de código.

## Áreas da plataforma

### Dashboard

Visão executiva do escopo selecionado (time específico ou Global). Combina
cards de severidade e status, evolução temporal, distribuição por categoria,
top projetos e tabela detalhada. Os widgets podem ser reorganizados, exibidos
ou ocultados individualmente, e o layout resultante pode ser salvo como
**perfil** — reutilizável pela própria pessoa ou compartilhado com o time.

Inclui o botão **Resumo Executivo**, que exporta um PDF consolidado para
compartilhamento, e um link direto para o **Modo TV** (dashboard em tela
cheia, com atualização automática configurável).

### Observations (Feed)

Lista navegável de todos os achados do escopo selecionado. Cada linha mostra
status, arquivo, categoria, subcategoria, branch, severidade e responsável.
Clicar em uma observation abre um painel lateral com:

- **Overview** — projeto, repositório, branch, ID, detalhes do problema.
- **Security** — referência OWASP, explicação de por que é um problema e como
  corrigir.

Atribuição em massa e filtro DBQL ficam disponíveis no cabeçalho.

### SAST

Histórico de execuções do scanner, com data, status, número de ocorrências,
padrões avaliados e falhas. O botão **Executar Scanner** dispara uma nova
varredura manual e permite escolher um **perfil de patterns** salvo — ou, por
padrão, todos os patterns ativos.

### Wiki

Documentação interna, editável diretamente pela interface. Estruturada em
pastas:

- **Getting Started** — páginas como esta.
- **User Guide** — manual por funcionalidade.
- **Admin** — configuração e operação (visível para admins).
- **\_dev** — documentação técnica (admins, em ambiente de desenvolvimento).
- **Changelog** — notas de release.

Todo o conteúdo é indexado automaticamente para o assistente de IA.

### Settings

Configuração do tenant dividida em duas seções:

**Organização**

- **Perfil** — dados do usuário.
- **Dashboards** — layouts salvos do Dashboard e do Modo TV.
- **Projetos** — projetos do tenant, com repositórios vinculados.
- **Repositórios** — repositórios sincronizados.
- **Times** — times e seus projetos associados.
- **Queries** — consultas DBQL salvas.

**Administração** (admins)

- **Admin** — gestão de tenants e usuários, incluindo impersonation.
- **Padrões de Segurança** — regras de detecção do scanner SAST.
- **Backup & Restore** — exportação e restauração de coleções MongoDB.
- **API Docs** — documentação OpenAPI das rotas internas.
- **Auth (OpenID)** — configuração do Keycloak. _(em breve)_
- **Integrations (Azure)** — conexões com serviços externos. _(em breve)_

## Funcionalidades transversais

### DBQL — linguagem de consulta

Todas as listas e dashboards aceitam filtros em DBQL. A sintaxe é
`propriedade:valor` combinada com operadores lógicos:

| Operador           | Descrição         |
| ------------------ | ----------------- |
| `AND`, `OR`, `NOT` | Combinação lógica |
| `!`                | Atalho de negação |
| `( )`              | Agrupamento       |
| `*`                | Curinga           |

Exemplo:

    category:"Broken Access Control" AND status:open

Os campos disponíveis variam por contexto (observations, projects,
repositories). Use o botão **?** ao lado do campo de busca para ver a ajuda
completa.

### Consultas salvas

Qualquer filtro DBQL pode ser salvo como **Saved Query**, com três níveis de
visibilidade:

- **Privada** — só você vê.
- **Compartilhada** — visível para o seu time.
- **Pública** — visível para todos.

Consultas salvas podem ser reutilizadas em qualquer tela, com um clique.

### Perfis de Dashboard

Layouts de widgets podem ser salvos como **perfis** e reutilizados em
qualquer sessão. Mesma taxonomia de visibilidade das Saved Queries
(privada / compartilhada / pública). Perfis do tipo **TV** também guardam
configurações de refresh automático e ciclagem entre times.

### Assistente de IA

Disponível no cabeçalho de todas as páginas. Responde perguntas em linguagem
natural consultando a Wiki e os dados do sistema via RAG. Exemplos:

- _"Como escrevo uma query DBQL para severidade crítica no projeto X?"_
- _"Quais observations críticas existem no branch main?"_
- _"O que mudou na release 2026.9.20?"_

### Multi-tenant e autenticação

A plataforma é multi-tenant: cada usuário está associado a um tenant e vê
apenas os dados desse escopo. A autenticação é feita via **Keycloak** (OpenID
Connect), com grupos e papéis do diretório corporativo definindo permissões:

- **Analyst** — acesso a Dashboard, Feed, SAST, Wiki e configurações do
  próprio tenant.
- **Admin** — acesso adicional a `/settings/admin/*` (gestão de tenant,
  usuários, impersonation, backup/restore, patterns).

### Backup e Restore

Administradores podem exportar as coleções do MongoDB para um diretório de
dumps e restaurar backups anteriores. O sistema cria um backup de segurança
automático antes de qualquer restore destrutivo.

## Roadmap

Integrações planejadas para expandir a cobertura de segurança além do SAST
atual:

- **Trivy** — vulnerabilidades em containers e dependências.
- **Dependency-track** — SBOM e vulnerabilidades em dependências.
- **SonarQube** — qualidade e segurança de código.

Novas funcionalidades são anunciadas na seção [Changelog](/wiki/changelog).

## Próximos passos

- [Primeiros Passos](/wiki/getting-started/quick-start) — configure sua conta.
- [Referência DBQL](/wiki/user-guide/dbql/1.Syntax) — domine os filtros.
- [Assistente de IA](/wiki/getting-started/system-overview#assistente-de-ia)
  — pergunte em linguagem natural.
