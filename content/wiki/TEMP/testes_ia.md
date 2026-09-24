## Suite de testes — IA do DebitBoard (v2)

Versão atualizada após as correções: `extractTimeRange` Unicode-safe, `timeline` com `firstSeen`, `EXEC_PATTERNS` expandidos, multi-team ordenado, streaming com efeito de digitação, corte server-side no `[FIM]`.

**Base de referência** (para validar números):
- Teams conhecidos: `GEPIN`, `GDSAF`, `GDSAT`, `GEINI`, `PGTIC`, `APISec - TEST`, `Global` (este último é `isGlobal: true`, deve ser excluído de comparativos)
- Range de dados: 2026-08-25 → 2026-09-11 (observations mais recentes têm ~12 dias)

---

### Grupo A — Resumo executivo por time

| # | Query | Modo | Snapshot | Validar |
|---|---|---|---|---|
| A1 | `gere um resumo executivo do time GEPIN` | direct | `# Resumo Executivo — Time GEPIN` | Tabela severidade/status + categorias com padrões distintos > 0 + padrões com nomes reais + projetos vinculados |
| A2 | `resumo executivo do time GDSAF` | direct | `Time GDSAF` | Mesmo padrão |
| A3 | `me dê um resumo executivo do time GDSAT` | direct | `Time GDSAT` | Mesmo padrão |
| A4 | `resumo executivo do GEPIN` | direct | `Time GEPIN` | Sem a palavra "time" |
| A5 | `dashboard do time GEPIN` | direct | `Time GEPIN` | `dashboard` sozinho dispara |
| A6 | `overview do time GDSAF` | direct | `Time GDSAF` | Sinônimo funciona |
| A7 | `panorama do time GDSAT` | direct | `Time GDSAT` | Sinônimo funciona |
| A8 | `resumo de segurança do time GEPIN` | direct | `Time GEPIN` | Padrão 4 do `EXEC_PATTERNS` |

**Não pode aparecer em nenhum:** "lidera em termos de...", "seguido pelo time...", "Observação: ...", `[FIM]` visível, bullets duplicando tabela, pergunta reescrita no final.

---

### Grupo B — Stats & Usage com período

| # | Query | Modo | Snapshot esperado | Validar |
|---|---|---|---|---|
| B1 | `stats do time GEPIN` | direct | `(últimos 30 dias)` | Default 30d |
| B2 | `stats do time GDSAF dos últimos 7 dias` | direct | `(últimos 7 dias)` | **Regex Unicode-safe** |
| B3 | `estatísticas do time GEPIN dos últimos 3 meses` | direct | `(últimos 90 dias)` | Conversão meses |
| B4 | `evolução do time GEPIN` | direct | `(últimos 30 dias)` | `evolução` dispara STATS |
| B5 | `stats do time GDSAF dos últimos 14 dias` | direct | `(últimos 14 dias)` | Timeline mostra dados de Aug 25 – Sep 11 |
| B6 | `tendência do time GDSAT nos últimos 60 dias` | direct | `(últimos 60 dias)` | Timeline com dados |

**Não pode aparecer:** `(últimos 30 dias)` quando o usuário pediu outro período. Timeline vazia quando o período cobre o range de dados.

---

### Grupo C — Comparativos

| # | Query | Modo | Snapshot esperado | Validar |
|---|---|---|---|---|
| C1 | `compare os times` | direct | `# Comparativo entre times` | Tabela com todos, **sem** Global |
| C2 | `comparativo dos times` | direct | Idem | |
| C3 | `todos os times` | direct | Idem | |
| C4 | `quais times existem` | direct | Idem | |
| C5 | `compare os times GDSAF e GDSAT` | direct | `# Comparativo — GDSAF vs GDSAT` | Só 2, ordem da query |
| C6 | `comparativo do resumo executivo dos times GDSAT e GEPIN` | direct | `GDSAT vs GEPIN` | GDSAT primeiro |
| C7 | `GDSAF vs GEPIN` | direct | `GDSAF vs GEPIN` | Detecção por menção |
| C8 | `compare GEPIN, GDSAF e GDSAT` | direct | `GEPIN vs GDSAF vs GDSAT` | 3 times, ordem preservada |
| C9 | `comparativo dos times GEPIN e GDSAF` | direct | `GEPIN vs GDSAF` | Ordem da query (não por volume) |

**Não pode aparecer:** `NaN`, "Observação: ...", tabela vertical de detalhamento repetindo a visão geral. **Deve aparecer:** seção "Top 5 categorias por time" com detalhamento por categoria.

---

### Grupo D — Top N categorias

| # | Query | Modo | Snapshot esperado |
|---|---|---|---|
| D1 | `top 5 categorias` | direct | `# Top 5 categorias` |
| D2 | `top 10 categorias` | direct | `# Top 10 categorias` |
| D3 | `top 5 categorias com status open` | direct | `(status \`open\`)` |
| D4 | `top 5 categorias do time GEPIN` | direct | `(time \`GEPIN\`)` |
| D5 | `top 3 categorias de severidade crítica` | direct | `(severidade \`critical\`)` |
| D6 | `categorias mais frequentes do time GDSAF` | direct | `(time \`GDSAF\`)` |
| D7 | `top 3 categorias do time GEPIN com status open` | direct | Ambos os filtros |
| D8 | `distribuição por categoria` | direct | `# Top 8 categorias` (default) |

---

### Grupo E — Top N padrões de detecção

| # | Query | Modo | Snapshot esperado |
|---|---|---|---|
| E1 | `top 5 padrões de detecção` | direct | `# Top 5 padrões de detecção` |
| E2 | `top padrões do time GEPIN` | direct | `(time \`GEPIN\`)` |
| E3 | `padrões mais frequentes` | direct | Default 8 |
| E4 | `top 3 subcategorias` | direct | Sinônimo funciona |

**Não pode aparecer:** `(padrão desconhecido)` na maioria das linhas (valida `$lookup` em `vulnerabilitypatterns`).

---

### Grupo F — Top N projetos e repositórios

| # | Query | Modo | Snapshot esperado |
|---|---|---|---|
| F1 | `top 10 projetos com mais observations` | direct | `# Top 10 projetos` |
| F2 | `projetos mais afetados` | direct | Default 10 |
| F3 | `top 5 projetos do time GEPIN` | direct | `(time \`GEPIN\`)` |
| F4 | `top 8 repositórios` | direct | `# Top 8 repositórios` |
| F5 | `repositórios mais afetados` | direct | Default 8 |

---

### Grupo G — Snapshot global

| # | Query | Modo | Snapshot esperado |
|---|---|---|---|
| G1 | `quantas observations críticas temos?` | direct | `# Snapshot global` |
| G2 | `qual o total de observations abertas?` | direct | Com filtro `open` |
| G3 | `panorama geral` | direct | Sem time/projeto |
| G4 | `resumo do sistema` | direct | |
| G5 | `overview de segurança` | direct | |

---

### Grupo H — Documentação pura (RAG sem live)

| # | Query | Modo | Validar |
|---|---|---|---|
| H1 | `o que é DBQL?` | llm, live vazio | Resposta em Markdown com `propriedade:valor` |
| H2 | `como escrevo uma query DBQL?` | llm | Bloco ` ```dbql ` com exemplo |
| H3 | `o que é o DebitBoard?` | llm | Menciona ASPM, SAST — **nunca** contratos/licitações |
| H4 | `quais integrações estão planejadas?` | llm | Apenas Trivy, Dependency-track, SonarQube |
| H5 | `o que é uma observation?` | llm | Definição correta |
| H6 | `o que significa severity:critical?` | llm | Explica severidade |
| H7 | `o que é o padrão AllowAnonymous?` | llm | Explica o padrão de detecção |
| H8 | `como a IA funciona?` | llm | RAG, wiki, live data |

**Não pode aparecer:** SQL (`SELECT`, `FROM`, `WHERE`), menção a "plataforma de contratos/créditos/débitos", cópia do `response-format` ou `dbql-cheatsheet`.

---

### Grupo I — Análise (LLM + dados)

| # | Query | Modo | Snapshot + análise |
|---|---|---|---|
| I1 | `analise o time GEPIN` | llm | Snapshot + 1 frase interpretativa |
| I2 | `compare os times e diga qual está pior` | llm | Comparativo + análise |
| I3 | `explique a situação de segurança do GDSAF` | llm | Snapshot + explicação |
| I4 | `o que devo priorizar no time GEPIN?` | llm | Sugere priorização |
| I5 | `qual a tendência do time GDSAT?` | llm | Interpreta timeline |
| I6 | `me dê uma recomendação para o time GDSAF` | llm | Recomendação baseada em dados |

---

### Grupo J — Filtros combinados

| # | Query | Modo | Snapshot esperado |
|---|---|---|---|
| J1 | `observations com status open do time GEPIN` | direct | Snapshot com filtro `status=open` |
| J2 | `top 5 categorias de severidade crítica do time GEPIN` | direct | Ambos os filtros |
| J3 | `quantas críticas abertas no GDSAF?` | direct | Filtros combinados |
| J4 | `top 3 projetos do time GEPIN com status open` | direct | |
| J5 | `categorias do time GDSAF com severidade alta e status open` | direct | 3 filtros |

---

### Grupo K — Negativos (recusa esperada)

| # | Query | Resposta esperada |
|---|---|---|
| K1 | `qual a previsão do tempo em Salvador?` | "Não encontrei essa informação na documentação do DebitBoard." |
| K2 | `como vender bitcoins?` | Idem |
| K3 | `escreva um poema sobre segurança` | Idem |
| K4 | `quantas pessoas nasceram em 2024?` | Idem |
| K5 | `me conte uma piada` | Idem |
| K6 | `quem é o presidente do Brasil?` | Idem |

**Não pode aparecer:** resposta inventada, menção a produtos que não são o DebitBoard.

---

### Grupo L — Anti-template leakage

| # | Query | Não pode aparecer |
|---|---|---|
| L1 | `gere um resumo executivo do time GEPIN` | "regras", "formato", "exemplo", "resposta ideal", "não faça", "Use Markdown", `[FIM]` |
| L2 | `top 5 categorias` | Idem |
| L3 | `compare os times` | Idem |
| L4 | `o que é DBQL?` | Cópia do cheatsheet inteiro — resposta deve ser direta |
| L5 | `stats do time GEPIN` | Idem |

**Se `[FIM]` aparecer na resposta final**, o corte server-side falhou.

---

### Grupo M — Streaming e UX

| # | Query | Validar |
|---|---|---|
| M1 | `resumo executivo do time GEPIN` | Conteúdo aparece **progressivamente** (efeito digitação), não instantâneo |
| M2 | `top 5 categorias` | Idem |
| M3 | `o que é DBQL?` | Stream natural (LLM), sem buffer de bloco |
| M4 | Pergunta em modo direct | Latência < 200ms até o primeiro caractere |
| M5 | Pergunta em modo llm | Latência 5-30s dependendo do contexto |
| M6 | Botão de áudio funciona | TTS pt-BR reproduz a resposta |
| M7 | Botão de copiar funciona | Copia markdown completo |
| M8 | Avatar do usuário aparece | Foto/inicial, não ícone genérico |

---

### Grupo N — Multi-turno (depende de memória de conversa)

| # | Sequência | Validar |
|---|---|---|
| N1 | `resumo executivo do time GEPIN` → `agora do GDSAF` | Segunda resposta traz GDSAF |
| N2 | `top 5 categorias` → `e com status open?` | Segunda aplica filtro |
| N3 | `o que é DBQL?` → `me dê um exemplo` | Segunda dá bloco DBQL |

**Nota:** se o `AIChatModal` envia apenas a última mensagem (sem histórico), N1–N3 vão falhar por design. **Verificar antes de marcar como requisito.** Hoje o `AIChatModal` envia `{ query, context, ... }` — só a query atual. Se quiser multi-turno, precisa incluir as mensagens anteriores no body.

---

### Grupo O — Histórico de conversa no modal

| # | Ação | Validar |
|---|---|---|
| O1 | Pergunta → resposta → nova pergunta | Ambas as perguntas e respostas visíveis |
| O2 | Fechar modal e reabrir | Histórico **limpo** (nova sessão) — ou preservado, decidir |
| O3 | Scroll automático durante streaming | Acompanha sem "pular" |
| O4 | Resposta longa (comparativo) | Scroll até o final automaticamente |

---

## Como executar

### Preparação

Antes da rodada completa, faça 2 perguntas quaisquer para garantir que o Ollama está quente e o warmup já rodou:

```bash
# No terminal do dev server, espere por:
[instrumentation] ollama warmup concluído (qwen2.5:3b)
```

### Durante a rodada

Para cada pergunta, colete **três coisas**:

1. **Linha `[rag]` do terminal:**
   ```
   [rag] q="..." mode=<direct|llm> live=[<título>] analysis=<true|false>
   ```

2. **Resposta na UI:** screenshot ou copiar o markdown renderizado.

3. **Latência:** "POST /api/ai/rag 200 in XXXms" no log.

### Critério de aprovação

Cada grupo só é considerado **verde** se **todos** os testes passarem com:

- `mode` correto no log
- `live=[...]` com o snapshot esperado (ou vazio quando documentação pura)
- Formato visual correto (tabelas com números reais, sem duplicação, sem `[FIM]`, sem prosa inventada)
- Sem `NaN`, sem "Observação:", sem template leakage
- Latência dentro do esperado (direct < 200ms TTFB, llm dentro da faixa)

Um único teste vermelho no grupo mantém o grupo amarelo até o fix.

## Prioridade para "fechar" a IA

Ordem para release:

1. **Grupo A, C, D, H** — núcleo. Sem esses, a IA não tem utilidade.
2. **Grupo B, F, G, J** — cobertura ampla. Sem eles, features importantes ficam fora.
3. **Grupo E, I, K, L** — qualidade e robustez.
4. **Grupo M** — UX (parcialmente novo, entrou com o streaming por chunks).
5. **Grupo N, O** — multi-turno. Depende de implementação adicional no modal. Deixar para v2.

## Próximos passos depois da rodada

Se grupos 1–2 estiverem verdes, a IA está pronta. Aí vamos para:

1. **DBQLAdvancedSearch** — você mencionou "bugs recorrentes". Preciso de 2–3 exemplos concretos (input + comportamento atual + esperado) para atacar.
2. **IA preenche DBQL direto** — trocar o modal de "copiar prompt" por endpoint `POST /api/ai/dbql` que devolve apenas a string DBQL, populando o campo automaticamente com validação em tempo real.

Cole os `[rag]` de qualquer teste que falhar e eu ajusto. Vamos fechar por grupo, não tudo de uma vez.