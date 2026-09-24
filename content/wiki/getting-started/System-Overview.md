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

Visão executiva do time selecionado, com totais por severidade e status,
distribuição por categoria e tabela de projetos. Inclui o botão **Resumo
Executivo**, que exporta um PDF consolidado para compartilhamento.

### Stats & Usage

Painel analítico do tenant com gráficos de:

- **Novas ocorrências** — evolução no tempo por severidade ou status.
- **Distribuição por Categoria** — proporção entre categorias de falha.
- **Total por Projeto** — projetos com maior volume de achados.

Todos os gráficos respondem ao filtro DBQL aplicado no topo da página.

### Observations (Feed)

Lista navegável de todos os achados de SAST do escopo selecionado. Cada linha
mostra status, arquivo, categoria, subcategoria, branch, severidade e
responsável. Clicar em uma observation abre um painel lateral com:

- **Overview** — projeto, repositório, branch, ID, detalhes do problema.
- **Security** — referência OWASP, explicação de por que é um problema e como
  corrigir.

### SAST Scanner

Histórico de execuções do scanner, com data, status, número de ocorrências,
padrões avaliados e falhas. O botão **Executar Scanner** dispara uma nova
varredura manual.

### Wiki

Documentação interna, editável diretamente pela interface. Estruturada em
pastas:

- **Getting Started** — páginas como esta.
- **User Guide** — manual por funcionalidade.
- **Admin** — configuração e operação (visível para admins).
- **_dev** — documentação técnica (admins, em ambiente de desenvolvimento).
- **Changelog** — notas de release.

Todo o conteúdo é indexado automaticamente para o assistente de IA.

### Settings

Configuração do tenant dividida em duas seções:

**Organização**
- **Perfil** — dados do usuário.
- **Projetos** — projetos do tenant, com repositórios vinculados.
- **Queries** — consultas DBQL salvas.
- **Repositórios** — repositórios sincronizados.
- **Times** — times e seus projetos associados.

**Administração** (admins)
- **Admin** — gestão de tenants e usuários, incluindo impersonation.
- **API Docs** — documentação OpenAPI das rotas internas.
- **Auth (OpenID)** — configuração do Keycloak.
- **Backup & Restore** — exportação e restauração de coleções MongoDB.
- **Integrations (Azure)** — conexões com serviços externos.
- **Padrões de Segurança** — regras de detecção do scanner SAST.

## Funcionalidades transversais

### DBQL — linguagem de consulta

Todas as listas e dashboards aceitam filtros em DBQL. A sintaxe é
`propriedade:valor` combinada com operadores lógicos:

| Operador | Descrição |
|---|---|
| `AND`, `OR`, `NOT` | Combinação lógica |
| `!` | Atalho de negação |
| `( )` | Agrupamento |
| `*` | Curinga |

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

### Assistente de IA

Disponível no cabeçalho de todas as páginas. Responde perguntas em linguagem
natural consultando a Wiki e os dados do sistema via RAG. Exemplos:

- *"Como escrevo uma query DBQL para severidade crítica no projeto X?"*
- *"Quais observations críticas existem no branch main?"*
- *"O que mudou na release 2026.9.20?"*

### Multi-tenant e autenticação

A plataforma é multi-tenant: cada usuário está associado a um tenant e vê
apenas os dados desse escopo. A autenticação é feita via **Keycloak** (OpenID
Connect).

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