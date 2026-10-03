# Risco Atual, SLA e Aging

> Documentação de referência dos indicadores **Risco Atual**, **SLA**
> e **Aging** apresentados no widget Resumo Executivo, no Dashboard e
> no Relatório Executivo em PDF. Cobre fórmulas, calibrações,
> referências da indústria e associações com padrões de segurança
> reconhecidos (OWASP, NIST, PCI-DSS, ISO 27001, CVSS, CWE, CVE).

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Risk Score — fórmula e calibração](#2-risk-score--fórmula-e-calibração)
3. [SLA — definição e cálculo](#3-sla--definição-e-cálculo)
4. [Aging — tempo em aberto](#4-aging--tempo-em-aberto)
5. [Exposição Atual — agregação](#5-exposição-atual--agregação)
6. [Mapeamento com padrões da indústria](#6-mapeamento-com-padrões-da-indústria)
7. [FAQ](#7-faq)
8. [Referências externas](#8-referências-externas)

---

## 1. Visão geral

Três métricas complementares resumem a **postura de segurança
presente** de um tenant, time ou projeto:

| Métrica | Pergunta que responde | Horizonte |
|---|---|---|
| **Risco Atual** | Qual é a exposição agregada agora? | Atemporal |
| **SLA** | Estamos corrigindo dentro do prazo combinado? | Atemporal |
| **Aging** | Há quanto tempo os itens estão abertos? | Atemporal |

Diferente das métricas de fluxo (contagens que aparecem em uma janela
temporal), estas três **ignoram o range selecionado no filtro**. Um
crítico aberto há 400 dias continua sendo um crítico aberto,
independente de o usuário estar olhando "últimos 7 dias" ou "tudo".

A única restrição de escopo é `status ∈ {open, recurring}` — itens
resolvidos, expirados ou marcados como "não corrigir" ficam de fora.

---

## 2. Risk Score — fórmula e calibração

### 2.1 Score por finding

Cada finding (observation ativa) recebe um score individual entre 0 e
10, calculado como:

```
findingRisk = base × exposure × status × slaPressure      (cap 10)
```

#### Fator `base`

Ponto de partida por severidade:

| Severidade | Base |
|---|---|
| Crítico | 8,0 |
| Alto | 6,0 |
| Médio | 4,0 |
| Baixo | 2,0 |

Quando o pattern SAST define seu próprio `score` (0–10), ele substitui
a base por severidade. Padrões bem calibrados permitem que um "Alto"
seja pontuado como 7,5 e um "Crítico" como 9,2 — refletindo o
impacto real.

#### Fator `exposure`

Mede quantas ocorrências do finding existem no código. Cresce
logaritmicamente:

```
exposure = 1 + min(1, log₁₀(1 + hits) / 2)
```

| Ocorrências | Fator |
|---|---|
| 1 | ~1,15 |
| 10 | ~1,50 |
| 100 | ~1,85 |
| 1000+ | 2,00 (teto) |

O logaritmo evita que uma única vulnerabilidade com milhares de
hits domine o score. 10× mais ocorrências **não** significa 10×
mais risco — a relação não é linear.

#### Fator `status`

| Status | Multiplicador | Racional |
|---|---|---|
| Aberto | 1,00 | Baseline |
| Recorrente | 1,15 | Regressão — foi corrigido, voltou |
| Não corrigir | 0,70 | Aceito, mas ainda exposto |
| Expirado | 0,50 | Fora do escopo |
| Corrigido | 0 | Removido do cálculo |

Um problema que **voltou** pesa mais que um que nunca foi resolvido.
Isso reflete a realidade de gestão: a correção anterior falhou, e a
equipe já investiu esforço sem resultado.

#### Fator `slaPressure`

Mede o tempo decorrido em relação ao prazo de SLA:

```
ratio = (agora - firstSeen) / (slaDueAt - firstSeen)

ratio >= 1,0  → 1,30   (SLA vencido)
ratio >= 0,8  → 1,15   (SLA em risco)
ratio <  0,8  → 1,00   (dentro do prazo)
```

O multiplicador de 1,30 em itens vencidos captura o fato de que
**exposição prolongada é exponencialmente pior** — cada dia adicional
aumenta a probabilidade de exploração.

### 2.2 Score agregado

O score final de um scan, projeto, time ou tenant é calculado sobre
o conjunto de findings ativos:

```
score = 0,40 × pior_componente
      + 0,35 × média_componente
      + 0,25 × densidade_componente
```

Onde cada componente é normalizado para 0–100.

#### `pior_componente`

O finding mais grave, multiplicado por 10. Peso 40%.

**Racional**: um único crítico exposto é catastrófico. A média
sozinha não captura isso — 1 crítico entre 100 baixos desapareceria
numa média. O pior caso ancora o score.

#### `média_componente`

A média de `findingRisk` de todos os findings ativos, multiplicada
por 10. Peso 35%.

**Racional**: mede a postura geral, sem deixar o pior caso dominar.
Um tenant com 100 altos (score alto) é diferente de um com 1 crítico
e 99 baixos (score médio), mesmo que o pior componente seja parecido.

#### `densidade_componente`

Volume ponderado por severidade:

```
peso = critical 1,0 | high 0,7 | medium 0,3 | low 0,05
densidade = min(100, log₁₀(1 + Σ pesos) × 40)
```

**Racional**: mede se o volume está se acumulando. Uma organização
com 500 baixos acumulados ao longo de anos não é o mesmo cenário que
uma com 5 baixos recentes — mesmo se a média for parecida.

### 2.3 Bandas

| Score | Banda | Cor | Leitura executiva |
|---|---|---|---|
| 0–19 | Mínimo | Verde | Postura sólida |
| 20–39 | Baixo | Verde-limão | Sob controle |
| 40–59 | Moderado | Âmbar | Requer atenção |
| 60–79 | Alto | Laranja | Ação prioritária |
| 80–100 | Crítico | Vermelho | Intervenção urgente |

Cada banda tem duas descrições:
- **Executiva** — para gestores e relatórios PDF
- **Especialista** — para times técnicos

### 2.4 Calibração empírica

| Cenário | Score aprox. | Banda |
|---|---|---|
| 1 crítico sozinho, 0 hits | ~72 | Alto |
| 20 críticos, 100 hits cada | ~82 | Crítico |
| 100 baixos acumulados | ~25 | Baixo |
| 5 críticos + 50 altos | ~78 | Alto |
| 500 médios | ~62 | Alto |

Os pesos foram ajustados para que "1 crítico" seja **Alto** (não
Crítico) — reservando a banda vermelha para casos onde **há volume
ou pluralidade** de problemas graves.

### 2.5 Como o score muda

O score é **recalculado a cada scan**. Nunca é editado manualmente.
Isso significa:

- Corrigir findings reduz o score no próximo scan
- Adicionar novo código com padrões detectados aumenta
- Itens vencidos pioram com o tempo (multiplicador de SLA)
- O histórico é imutável — você compara dois retratos

---

## 3. SLA — definição e cálculo

### 3.1 O que é SLA neste sistema

SLA (Service Level Agreement) define o **prazo máximo** para
corrigir um finding, contado a partir de `firstSeen` (data da primeira
detecção).

O prazo é definido pelo **pattern de detecção** no campo `slaHours`:

| Severidade típica | Prazo padrão |
|---|---|
| Crítico | 24–72 horas |
| Alto | 72–168 horas (3–7 dias) |
| Médio | 168–720 horas (7–30 dias) |
| Baixo | 720–2160 horas (30–90 dias) |

Cada pattern pode ter seu próprio prazo. Um pattern "SQL Injection"
pode ter 24h mesmo que sua categoria seja Alta.

### 3.2 Estados de SLA

Cada finding ativo é classificado em três estados:

| Estado | Condição | Cor | Significado |
|---|---|---|---|
| **Em dia** | `slaDueAt > agora` e ratio < 0,8 | Verde | Prazo confortável |
| **Em risco** | `slaDueAt > agora` e ratio ≥ 0,8 | Laranja | ≥80% do prazo consumido |
| **Vencido** | `slaDueAt <= agora` | Vermelho | Fora do prazo |

Onde:

```
ratio = (agora - firstSeen) / (slaDueAt - firstSeen)
```

#### Por que 80% e não 100%

O threshold de "em risco" em 80% é uma escolha deliberada:

- **Antecipação** — aos 80% ainda há tempo de agir antes do
  vencimento. Um alerta aos 95% seria inútil.
- **Benchmark** — a indústria (ServiceNow, Jira Service Management)
  usa 75–85% como zona de aviso.
- **Fuso de trabalho** — 20% do prazo de 72h = ~14h, uma janela de
  trabalho inteira.

### 3.3 SLA vencido — impacto no score

Itens vencidos recebem multiplicador de 1,30 no `slaPressure`.
Isso cria um **incentivo sistêmico** para que a equipe priorize o que
está vencendo, mesmo em cenários onde a severidade nominal seja menor.

### 3.4 SLA no widget Resumo Executivo

A barra de SLA no widget mostra a proporção entre os três estados,
com percentual ao lado do número. Exemplo:

```
SLA: Em dia: 200 (75,2%) · Em risco: 40 (15,0%) · Vencido: 26 (9,8%)
```

O percentual vencido é destacado em vermelho quando > 0 — a
informação "9,8% do backlog está fora do prazo" é acionável.

### 3.5 Cálculo em memória

Na rota `/api/stats/teams-executive`, o cálculo é feito em duas
partes:

1. **Agregação MongoDB** — `slaDueAt < agora` via `$cond` no
   `$sum`, dentro do `$facet.currentRaw`. Devolve os valores brutos
   de `severity`, `status`, `hitCount`, `firstSeen` e `slaDueAt`.
2. **Cálculo em Node** — itera sobre os findings e classifica cada
   um nos três estados, montando os totais por severidade, time e
   projeto.

O motivo de não classificar tudo no Mongo: o **Risk Score** exige o
array completo de findings (não só contadores), então já estamos
trazendo os dados. Classificar em memória aproveita a mesma passada.

---

## 4. Aging — tempo em aberto

### 4.1 O que é Aging

Aging é a **idade de cada finding ativo**, medida em dias desde
`firstSeen`. Não confundir com SLA:

| Métrica | Pergunta |
|---|---|
| **SLA** | "Estamos dentro do prazo?" |
| **Aging** | "Há quanto tempo isso está aberto?" |

Um finding de 45 dias com SLA de 90 dias está **em dia** mas tem
**aging de 45 dias**. Aging revela padrões que o SLA esconde —
como backlogs de itens de baixa severidade que nunca são corrigidos.

### 4.2 Buckets de aging

Quatro faixas, escolhidas por alinhamento com benchmarks da indústria:

| Bucket | Cor | Leitura |
|---|---|---|
| 0–30 dias | Verde | Recente — dentro do prazo típico de críticos |
| 31–60 dias | Âmbar | Aging moderado — começa a acumular |
| 61–90 dias | Laranja | Aging significativo — passou do prazo de altos |
| 90+ dias | Vermelho | Backlog crônico — problema estrutural |

#### Por que estes cortes

- **30 dias** — limite usual para críticos e altos em PCI-DSS 6.3.1
  e NIST SSDF PW.7.
- **60 dias** — pontos de análise intermediária. Um finding de 60
  dias e baixa severidade ainda é aceitável; um de 60 dias e alta
  severidade é alarmante.
- **90 dias** — limite usual para médios. Passou disso, é backlog.
- **90+** — não há limite superior. Itens aqui são o sinal mais forte
  de que o processo de remediation está falhando.

### 4.3 Aging vs. bucket vs. risco

Aging **não entra diretamente** no cálculo de risco. Indiretamente:

- Itens em aging alto tendem a ter `slaPressure` alto (1,15 ou 1,30)
- Itens com aging alto e severidade alta inflam o `pior_componente`
- O volume em 90+ aumenta a `densidade_componente`

Isso significa que **aging é preditivo de risco futuro** — ele mostra
onde o risco vai chegar se a equipe não agir.

### 4.4 Como ler o painel de aging

```
Tempo em aberto: 0–30d: 180 · 31–60d: 60 · 61–90d: 20 · 90d+: 6
```

Interpretação em três camadas:

| Camada | Leitura |
|---|---|
| **Volume total** | 266 itens abertos |
| **Distribuição** | Concentração em 0–30d (67%) é saudável |
| **Cauda** | 26 itens (9,8%) acima de 60d merecem investigação |
| **Crônicos** | 6 itens (2,3%) acima de 90d precisam de decisão explícita |

Uma regra de bolso: se **>10% do backlog está em 90+ dias**, o
processo de remediation está quebrado. Não é um problema de
priorização — é um problema de capacidade ou de fluxo.

---

## 5. Exposição Atual — agregação

### 5.1 Escopo

O bloco "Risco Atual" no Resumo Executivo agrega:

- **Risk Score** — cálculo descrito na seção 2
- **Totais por severidade** — contagem de findings ativos
- **SLA** — distribuição nos três estados
- **Aging** — distribuição nos quatro buckets
- **Top projetos por risco** — ranking de projetos por score

Todos com o mesmo filtro de base: `status ∈ {open, recurring}` e
`tenantId`/`teamId`/`dbql` aplicados, **range ignorado**.

### 5.2 Níveis de agregação

O painel mostra três níveis simultaneamente:

| Nível | O que representa |
|---|---|
| **Tenant** | Todos os findings ativos do tenant |
| **Time** | Findings dos projetos do time |
| **Projeto** | Findings do projeto específico |

Um finding pertence a **exatamente um** projeto, que pertence a
**exatamente um** time. Não há dupla contagem.

### 5.3 Por que "ignora o range"

É a única seção do dashboard onde o filtro de janela temporal é
suspenso. Motivo: a pergunta "qual é minha exposição agora?" não faz
sentido com horizonte temporal. Um crítico aberto há 6 meses continua
sendo um crítico aberto — escondê-lo porque o usuário escolheu "últimos
7 dias" seria ativamente enganoso.

Isso é sinalizado na UI:
- Subtítulo do grupo: "Abertas + recorrentes · ignora a janela temporal"
- No PDF, anotação explícita ao lado do título
- Cor diferenciada do ícone (laranja de alerta, não brand)

---

## 6. Mapeamento com padrões da indústria

### 6.1 OWASP SAMM

**Software Assurance Maturity Model**

| Prática | Requisito | Como atendemos |
|---|---|---|
| **VM-1** — Vulnerability Management: Establish | Cadastrar e classificar vulnerabilidades | Todo finding tem severidade, categoria e pattern origem |
| **VM-2** — Assess | Medir o estado atual do risco | Risk Score agregado por scan, projeto, time, tenant |
| **VM-3** — Implement | Rastrear até a remediação | SLA por severidade + aging + estados |
| **VM-5** — Measure | Métricas de eficácia | Aging, SLA compliance, delta de risco entre scans |

### 6.2 NIST SSDF

**Secure Software Development Framework** — SP 800-218

| Prática | Descrição | Como atendemos |
|---|---|---|
| **PW.7** | Review and/or analyze human-readable code | SAST patterns com detecção automática |
| **PW.8** | Teste executável | Findings estruturados (não texto livre) |
| **RV.1** | Identify and confirm vulnerabilities on an ongoing basis | Scans recorrentes + risco agregado |
| **RV.3** | Analyze vulnerabilities to identify their root causes | Categorias OWASP/CWE + patterns |

### 6.3 PCI-DSS 6.3.1

**Requisito**: corrigir vulnerabilidades de severidade alta e crítica
em ≤ 30 dias.

| Comportamento | Implementação |
|---|---|
| SLA alvo de 30 dias para críticos/altos | `slaHours` dos patterns é tipicamente ≤ 720h |
| Alerta antes do vencimento | Aging bucket 0–30d + "em risco" a partir de 80% |
| Visibilidade do atraso | SLA vencido destacado em vermelho no widget e no PDF |

### 6.4 ISO 27001

**Controle A.8.8** — Management of technical vulnerabilities

| Sub-requisito | Como atendemos |
|---|---|
| Definir e comunicar papéis | (Não implementado — atribuição manual via UI) |
| Definir prazos | SLA por pattern |
| Identificar vulnerabilidades | SAST scan |
| Avaliar exposição | Risk Score |
| Definir e executar ações | Findings atribuídos e rastreados |
| Medir tempo de exposição | Aging buckets |
| Documentar | Reports PDF + histórico de scans |

### 6.5 CVSS — Common Vulnerability Scoring System

**Relação com nosso Risk Score**:

| Aspecto | CVSS | Risk Score |
|---|---|---|
| Escopo | Vulnerabilidade intrínseca | Exposição do tenant |
| Contexto | Ignora ativos afetados | Pondera hits, SLA, estado |
| Escala | 0–10 | 0–100 |
| Fonte | NVD / vendor | Cálculo interno |

**Não confundir**: o CVSS mede "quão grave é este CVE em abstrato".
O Risk Score mede "quão exposto o tenant está a esta vulnerabilidade
**agora**, dado o contexto".

Se um pattern SAST é derivado de um CVE com CVSS 9,8, o `score` do
pattern será próximo disso. Mas o impacto no Risk Score do tenant
dependerá do volume, estado, SLA e quantidade de hits.

### 6.6 OWASP Top 10

As **categorias** dos patterns mapeiam para o OWASP Top 10 2021:

| Categoria OWASP | Padrões internos |
|---|---|
| **A01:2021** Broken Access Control | `AllowAnonymous`, `Webservice sem Autenticação` |
| **A02:2021** Cryptographic Failures | `Segredos Hardcoded` |
| **A03:2021** Injection | `Injeção SQL`, `Injeção de Comando` |
| **A04:2021** Insecure Design | `Configuração Incorreta`, `Deserialização Insegura` |
| **A07:2021** Identification and Authentication Failures | `Session Fixation`, `Senha Fraca` |
| **A08:2021** Software and Data Integrity Failures | `Deserialização Insegura` |
| **A09:2021** Security Logging and Monitoring Failures | `Log de Credenciais` |
| **A10:2021** SSRF | `Server-Side Request Forgery` |

O campo `externalId` de cada pattern carrega o identificador OWASP
(ex.: `OWASP A01:2021`), exibido em referência nos cards não-admin.

### 6.7 CWE — Common Weakness Enumeration

Padrão de referência para **tipos de fraqueza**. Cada pattern pode
carregar um `externalIdCWE`.

| CWE | Descrição | Pattern exemplo |
|---|---|---|
| **CWE-79** | Improper Neutralization of Input During Web Page Generation (XSS) | `dangerouslySetInnerHTML` |
| **CWE-89** | SQL Injection | `String.Format` com SELECT |
| **CWE-352** | Cross-Site Request Forgery (CSRF) | `[ValidateAntiForgeryToken]` ausente |
| **CWE-502** | Deserialization of Untrusted Data | `BinaryFormatter.Deserialize` |
| **CWE-798** | Use of Hard-coded Credentials | `password = "..."` |

### 6.8 CVE — Common Vulnerabilities and Exposures

Registro público e único de vulnerabilidades. Formato: `CVE-ANO-NÚMERO`.

**Relação com CWE**: um CVE específico **instancia** um CWE. Ex.:
`CVE-2024-1234` pode ser uma instância de `CWE-89` (SQL Injection).

**Relação com nosso sistema**: patterns SAST podem ter um `externalId`
apontando para o CVE quando a detecção é derivada dele. Na
integração futura com **Trivy**, **DependencyTrack** e **SonarQube**,
os findings desses scanners trazem CVE como identificador primário —
mapearemos para o campo `externalId` dos patterns.

### 6.9 EPSS — Exploit Prediction Scoring System

**Não implementado atualmente**. EPSS dá uma probabilidade (0–1) de
que um CVE seja explorado nas próximas 4 semanas, baseado em dados
de exploração observados.

**Onde caberia**: substituindo o `base` de severidade para findings
derivados de CVE. Um CVE com EPSS 0,7 seria mais crítico que um CVE
com EPSS 0,01, mesmo se ambos forem "Alto" pelo CVSS.

**Quando implementar**: quando SCA (DependencyTrack/Trivy) entrar,
faz sentido adicionar EPSS como fator no cálculo.

### 6.10 Tabela consolidada de associações

| Padrão | Uso no nosso sistema | Onde aparece |
|---|---|---|
| **OWASP Top 10** | Categoria de findings | `Observation.category` |
| **CWE** | Tipo específico de fraqueza | `VulnerabilityPattern.externalIdCWE` |
| **CVE** | Identificador único de vulnerabilidade | `VulnerabilityPattern.externalId` |
| **CVSS** | Score de severidade intrínseca | `VulnerabilityPattern.score` (0–10) |
| **EPSS** | Probabilidade de exploração | *(futuro — SCA)* |
| **SAMM VM-2/3** | Framework de gestão de vulnerabilidades | Design do Risk Score + SLA + Aging |
| **NIST SSDF PW.7/RV.3** | Práticas de detecção e análise | SAST patterns + categorização |
| **PCI-DSS 6.3.1** | SLA de 30 dias para críticos/altos | `slaHours` dos patterns |
| **ISO 27001 A.8.8** | Gestão de vulnerabilidades técnicas | Estrutura completa (finding → correção → métrica) |

---

## 7. FAQ

**Por que meu tenant tem score 0 mesmo com findings abertos?**

Score 0 só ocorre com 0 findings ativos. Se o painel mostra findings
mas score 0, verifique: (a) os findings estão com status
`resolved`/`expired`/`wont_fix`, (b) o filtro DBQL está ativo e
exclui esses findings, (c) o painel está em modo TV mostrando dados
do ciclo anterior.

**Por que um "Alto" tem score maior que outro "Alto"?**

O `base` do pattern pode ser customizado. Um pattern com `score: 7,5`
produz finding mais grave que outro com `score: 6,0`, mesmo se ambos
listam "Alto" na categoria. É intencional — calibração por padrão.

**Qual é a diferença entre SLA vencido e aging > 90d?**

Um item pode ter SLA vencido mas aging baixo (crítico aberto há 3
dias com SLA de 48h). E pode ter aging > 90d mas SLA em dia (baixo
aberto há 100 dias com SLA de 180 dias). As duas métricas medem
coisas diferentes — leia em conjunto.

**O Risk Score pode ser maior que 100?**

Não. Cada finding tem cap em 10, e a agregação normaliza para 100.
É deliberado — manter 0–100 facilita a leitura como percentual.

**Por que 40% para o pior finding? Por que não 50% ou 60%?**

Calibração empírica. 60% deixaria o score dos tenants muito volátil
(1 finding resolve muda o score drasticamente). 30% subestimaria
findings críticos. 40% é o ponto onde "1 crítico = Alto" e "20
críticos = Crítico" produzem números coerentes com a intuição.

**Aging > 90d realmente significa backlog crônico?**

Sim, dentro da nossa calibração. É o intervalo onde médios já
estouraram o prazo típico (90d) e apenas baixos podem estar dentro.
Concentração nesse bucket indica falha de processo, não de
priorização.

**EPSS vai substituir CVSS no score?**

Não substitui — complementa. CVSS responde "quão grave é esta
fraqueza?"; EPSS responde "quão provável é que seja explorada?".
Ambos são úteis em contextos diferentes. Quando implementarmos, os
dois alimentarão o cálculo.

**Como funciona a integração com Trivy, DependencyTrack e SonarQube?**

Quando essas integrações existirem, os findings delas alimentarão
`Observation` com a mesma estrutura (severity, status, slaDueAt,
hitCount). O cálculo de Risk Score, SLA e Aging permanece idêntico —
apenas mais origens de dados. CVE passa a ser o `externalId`
primário dos findings desses scanners.

---

## 8. Referências externas

### Frameworks de gestão

- **OWASP SAMM** — https://owaspsamm.org/
- **NIST SSDF (SP 800-218)** — https://csrc.nist.gov/projects/ssdf
- **ISO 27001 A.8.8** — https://www.iso.org/standard/27001
- **PCI-DSS v4.0** — https://www.pcisecuritystandards.org/

### Padrões técnicos

- **OWASP Top 10** — https://owasp.org/Top10/
- **CWE** — https://cwe.mitre.org/
- **CVE** — https://www.cve.org/
- **CVSS v3.1 / v4.0** — https://www.first.org/cvss/
- **EPSS** — https://www.first.org/epss/

### Benchmarks de tempo de correção

- **Ponemon Institute** — Cost of a Data Breach Report
- **Red Hat** — Vulnerability remediation benchmarks
- **Veracode State of Software Security** — MTTR by severity

### Ferramentas de referência (integração futura)

- **Trivy** — https://trivy.dev/
- **DependencyTrack** — https://dependencytrack.org/
- **SonarQube** — https://www.sonarsource.com/products/sonarqube/

---

## Glossário rápido

| Termo | Significado |
|---|---|
| **Finding** | Um problema específico detectado (uma observation ativa) |
| **Pattern** | A regra SAST que detecta um tipo de problema |
| **Categoria** | Agrupamento de patterns (ex.: "Broken Access Control") |
| **Scan** | Uma execução do SAST contra um conjunto de patterns |
| **Observation** | Registro persistente de um finding (persiste entre scans) |
| **Tenant** | Organização cliente (multi-tenancy do sistema) |
| **Team** | Time dentro de um tenant, dono de projetos |
| **Project** | Projeto/repositório dentro de um time |
| **SLA** | Prazo máximo para corrigir (Service Level Agreement) |
| **Aging** | Tempo decorrido desde `firstSeen` |
| **Risk Score** | Score agregado 0–100 |
| **Banda** | Faixa do Risk Score (Mínimo a Crítico) |
| **Flow** | Métrica que respeita a janela temporal |
| **State** | Métrica atemporal — exposição presente |