# Evolução de Risco

> Documento de referência do gráfico **Evolução de Risco** e dos
> indicadores de risco que ele apresenta. Cobre o cálculo, as
> convenções visuais, os significados de cada coluna e o glossário
> de padrões da indústria de segurança usados como base.

## Visão geral

A **Evolução de Risco** mostra como a postura de segurança de um
tenant varia ao longo do tempo, agregando todos os scans concluídos
em uma série temporal única. A tela responde três perguntas em uma
leitura:

1. **Onde estamos agora?** — Score atual e banda de risco.
2. **Para onde estamos indo?** — Tendência linear entre os scans
   mais antigos e os mais recentes do período.
3. **O que aconteceu em cada scan?** — Grid detalhado com Δ,
   ocorrências, patterns e falhas.

A fonte de dados é o agregado dos scans executados pelo tenant.
Quando outros scanners são integrados (Trivy, DependencyTrack,
SonarQube), eles alimentam a mesma série — o gráfico e os
indicadores não mudam, apenas passam a contar com mais origens.

---

## O que é o Risk Score

O **Risk Score** é um número entre **0 e 100** que resume a
exposição atual do tenant a vulnerabilidades conhecidas. Não é uma
contagem: dois tenants podem ter o mesmo número de findings e
scores diferentes, porque o score pondera **severidade**,
**quantidade de arquivos afetados**, **estado do finding** e
**pressão de SLA**.

O score é recalculado a cada scan e persistido — o histórico nunca
é reescrito. Comparar o score de hoje com o de ontem é, portanto,
uma comparação entre dois retratos do mesmo ambiente em momentos
distintos.

### Bandas

| Faixa | Banda | Leitura executiva |
|---|---|---|
| 0 – 19 | **Mínimo** | Postura sólida. Nada crítico ou alto pendente. |
| 20 – 39 | **Baixo** | Sob controle. Riscos residuais, sem ação imediata. |
| 40 – 59 | **Moderado** | Requer atenção. Há itens abertos relevantes. |
| 60 – 79 | **Alto** | Ação prioritária. Riscos significativos expostos. |
| 80 – 100 | **Crítico** | Intervenção urgente. Riscos severos expostos. |

As bandas são a única fonte de verdade para cor e rótulo. Em toda
a aplicação, um score 93 sempre aparece como "Crítico" em vermelho;
um 72 sempre como "Alto" em laranja. Isso vale para o grid, o
widget do dashboard, o drawer de scan e esta tela.

---

## Como o Risk Score é calculado

O score combina quatro fatores por finding:

### 1. Severidade base (`base`)

| Severidade | Valor base |
|---|---|
| Crítico | 8,0 |
| Alto | 6,0 |
| Médio | 4,0 |
| Baixo | 2,0 |

O valor vem do pattern SAST (`pattern.score`) quando disponível;
caso contrário, usa o teto da faixa de severidade.

### 2. Exposição (`exposure`)

Mede quantas **ocorrências** o finding tem no código. Cresce
logaritmicamente: `1 + min(1, log₁₀(1 + hits) / 2)`.

| Ocorrências | Fator |
|---|---|
| 1 | ~1,15 |
| 10 | ~1,50 |
| 100 | ~1,85 |
| 1000+ | 2,00 (teto) |

O logaritmo evita que uma única vulnerabilidade com milhares de
hits domine o score — 10× mais ocorrências não significa 10× mais
risco.

### 3. Estado do finding (`status`)

| Estado | Multiplicador |
|---|---|
| Aberto | 1,00 |
| Recorrente | 1,15 |
| Não corrigir (aceito) | 0,70 |
| Expirado | 0,50 |
| Corrigido | 0 (removido do cálculo) |

O estado "Recorrente" pesa **mais** que "Aberto": um problema que
já foi corrigido e voltou é mais grave que um que nunca foi
resolvido.

### 4. Pressão de SLA (`slaPressure`)

| Situação | Multiplicador |
|---|---|
| SLA estourado | 1,30 |
| SLA acima de 80% consumido | 1,15 |
| Dentro do prazo | 1,00 |

### Score do finding

```
findingRisk = base × exposure × status × slaPressure    (teto 10)
```

### Agregação do scan

O score do scan combina três componentes:

```
score = 0,40 × pior_componente
      + 0,35 × média_componente
      + 0,25 × densidade_componente
```

- **Pior componente** — o finding mais grave do scan (peso 40%).
  Um único crítico já puxa o score para cima.
- **Média** — a média de todos os findings ativos (peso 35%).
  Reflete a postura geral, não o pior caso.
- **Densidade** — o volume ponderado por severidade
  (`log₁₀(1 + Σ pesos) × 40`, com peso 1,0 para crítico,
  0,7 para alto, 0,3 para médio, 0,05 para baixo).
  Mede se o volume de findings está se acumulando.

Calibrações de referência:

| Cenário | Score aproximado | Banda |
|---|---|---|
| 1 crítico, nada mais | ~72 | Alto |
| 20 críticos | ~82 | Crítico |
| 100 baixos, nada crítico | ~25 | Baixo |

---

## O gráfico de Evolução

O gráfico exibe uma linha de **Risco** (azul) ao longo dos scans
do período. Cada ponto é um scan, cada eixo X é a data, cada eixo
Y é o score de risco.

### Componentes visuais

| Elemento | Cor | Significado |
|---|---|---|
| **Linha de Risco** | azul | Dado medido — o score real de cada scan |
| **Linha de Tendência** | âmbar | Projeção — regressão linear simples, mostra a direção global |
| **Linha de Mediana** | roxa (tracejada) | Referência — valor central do período |
| **Ponto de Risco** | cor da banda | Cada ponto é colorido conforme a faixa de risco atingida |

### Linha de Tendência

É o ajuste por mínimos quadrados de todos os pontos exibidos. Ela
**não prevê o futuro**; apenas resume matematicamente para onde a
série está apontando dentro do período mostrado.

- Tendência subindo (linha âmbar acima da azul, ou com inclinação
  positiva) → risco aumentando.
- Tendência descendo → risco diminuindo.
- Tendência horizontal → risco estável.

### Linha de Mediana

Linha horizontal tracejada que marca o valor mediano dos scores do
período. Serve como **referência visual rápida**: um scan acima da
mediana está acima da metade histórica; abaixo, está na porção
melhor.

Não aparece na tooltip de cada ponto — é uma anotação, não uma
medida que varia ponto a ponto.

### Escala do eixo Y

Por padrão, a escala **não começa em zero** — começa uma faixa
abaixo do menor risco do período. Ex.: se o menor risco exibido é
71 e a faixa é 10, o eixo começa em 60.

Motivo: em séries onde todos os valores estão na metade superior
(70–100, por exemplo), começar em zero achataria a curva e
esconderia variações importantes como −5 ou +3. A escala
adaptativa preserva a leitura de variação relativa sem distorcer.

Quando é necessário comparar períodos com faixas muito diferentes,
é possível voltar à escala zerada — mas essa não é a configuração
padrão.

### Seleção de período

Clique em **dois pontos** do gráfico para selecionar o intervalo.
Os KPIs do topo e a tabela abaixo passam a refletir apenas os
scans dentro do intervalo selecionado. O botão "Limpar seleção"
volta ao período completo.

Durante a seleção:
- O primeiro clique marca o **ponto inicial** (fica roxo).
- Um segundo clique marca o **ponto final** e aplica o filtro.
- Clicar duas vezes no mesmo ponto cancela a seleção em curso.

---

## O grid "Scans no período"

Tabela detalhada, uma linha por scan, ordenada do mais recente para
o mais antigo.

| Coluna | O que mostra |
|---|---|
| **Data** | Timestamp de conclusão do scan |
| **Risco** | Score + banda, com cor da banda |
| **Δ** | Diferença em relação ao **scan imediatamente anterior** |
| **Ocorrências** | Soma de hits encontrados no scan |
| **Patterns** | Quantidade de patterns executados |
| **Falhas** | Patterns que não executaram com sucesso |
| **Tendência** | Direção do Δ (Melhora / Piora / Estável / Baseline) |

### A coluna Δ

O **Δ** compara o risco desta linha com o risco do **scan
cronologicamente anterior** — que, por causa da ordem da tabela
(mais novo → mais antigo), é a **linha imediatamente abaixo**.

- Δ **positivo** → o risco **aumentou** desde o scan anterior.
  Exibido em vermelho.
- Δ **negativo** → o risco **diminuiu**. Exibido em verde.
- Δ **zero** → o risco **não mudou**. Exibido em cinza.
- Δ **—** (Baseline) → primeiro scan do período. Não há scan
  anterior para comparar.

### Diferença entre "Δ" e "Tendência"

São **duas leituras complementares**, não redundantes:

| | Δ (coluna) | Tendência (badge) |
|---|---|---|
| Escopo | Scan atual vs. scan anterior | Período inteiro |
| Responde | "Melhorou em relação ao último scan?" | "Estamos melhor ou pior no acumulado?" |
| Sinal local | Sim | Não — é global |

Exemplo: um scan pode ter Δ **+19** (piorou muito vs. o anterior),
enquanto a tendência do período é **−8** (melhora acumulada). Ambos
os sinais convivem: houve um pico ruim, mas a direção de longo
prazo é de melhora.

### Badges de tendência

| Badge | Significado |
|---|---|
| **Baseline** | Primeiro scan do período. Não há base de comparação. |
| **Melhora** | Δ negativo (risco reduziu). |
| **Piora** | Δ positivo (risco aumentou). |
| **Estável** | Δ zero (risco inalterado). |

---

## KPI "Risco Atual"

Card no topo da tela e no widget do dashboard. Exibe o score e a
banda do **scan mais recente do período selecionado**.

- **Borda e tinta tonal** variam conforme a banda (verde, amarelo,
  laranja, vermelho).
- **Fundo** nunca é preenchido com a cor da banda — apenas uma
  tinta sutil (5%). A decisão segue as diretrizes do Material
  Design 3: cards de KPI usam "filled tonal" (baixa saturação),
  reservando o "filled" saturado para alertas de bloco único.
  Evita fadiga visual quando há vários scans críticos em sequência.

---

## Glossário de padrões da indústria

O sistema usa como referência os principais padrões de
categorização de vulnerabilidades da indústria. Eles são a base
para o campo "Categoria" dos findings e para a escolha dos
patterns de detecção.

| Sigla | Nome | O que é |
|---|---|---|
| **OWASP** | Open Worldwide Application Security Project | Comunidade que publica guias e listas de referência. A lista **OWASP Top 10** (ex.: A01:2021 Broken Access Control) é o padrão de facto para categorizar riscos de aplicação web. |
| **CVE** | Common Vulnerabilities and Exposures | Identificador único e público de uma vulnerabilidade específica. Formato: `CVE-ANO-NÚMERO` (ex.: CVE-2024-1234). Um CVE é um registro, não uma categoria. |
| **CWE** | Common Weakness Enumeration | Catálogo de **tipos** de fraqueza (ex.: CWE-79 Cross-Site Scripting). Um CWE pode ter vários CVEs associados. |
| **CVSS** | Common Vulnerability Scoring System | Sistema numérico (0–10) que pontua a severidade de um CVE. Não confundir com o **Risk Score** desta aplicação: o CVSS mede a severidade **intrínseca** de uma vulnerabilidade; o Risk Score mede a exposição **do tenant**, ponderando contexto (estado, SLA, volume). |
| **SLA** | Service Level Agreement | Prazo máximo para corrigir um finding, definido por severidade. Contar violação de SLA é o que alimenta o fator `slaPressure` do score. |

### Como usar cada um

- **Para priorizar técnico:** severidade + CVE + CVSS.
- **Para reportar a executivos:** banda de risco (Mínimo a Crítico) + tendência.
- **Para auditoria:** CWE (taxonomia) + CVE (registro específico) + OWASP (categoria).

---

## FAQ

**Por que dois scans consecutivos podem ter o mesmo risco mas Δ
diferente de zero?**
Porque o Δ compara cada scan com o **anterior a ele**, e não com o
primeiro da série. Dois scans com 93 cada podem ter Δ = 0 se foram
consecutivos, ou Δ ≠ 0 se um scan intermediário teve score
diferente.

**Por que o eixo Y não começa em zero?**
Porque os scores tendem a se concentrar na metade superior da
escala (40–100). Começar em zero achataria a curva e tornaria
invisíveis variações pequenas mas importantes. Ver a seção
"Escala do eixo Y".

**Por que a tooltip só mostra o risco, e não a tendência ou a
mediana?**
Porque a tooltip exibe o **valor do dado sob o ponteiro**. Tendência
e mediana são linhas de referência — mostrar seus valores em cada
ponto adicionaria ruído, não informação. A mediana aparece no
rodapé e na legenda; a tendência é lida pelo traçado da linha.

**Um score de 93 hoje é pior que um score de 80 ontem?**
Nem sempre. O score pondera o estado e o SLA, que mudam entre
scans. Um 93 com poucos findings urgentes pode ser mais grave que
um 80 com muitos findings em atraso. Sempre leia o score **junto**
da banda, do Δ e das colunas de ocorrências e falhas.

**Quando os scanners Trivy, DependencyTrack e SonarQube forem
integrados, o cálculo muda?**
Não. Os novos scanners alimentam as mesmas entidades (findings com
severidade, status, SLA). O Risk Score continua sendo o mesmo
cálculo, aplicado sobre um conjunto mais amplo de findings. A série
temporal passa a ter mais dados por scan, mas a semântica não muda.

---

## Referências externas

- **OWASP Top 10** — https://owasp.org/Top10/
- **CWE** — https://cwe.mitre.org/
- **CVE** — https://www.cve.org/
- **CVSS** — https://www.first.org/cvss/
- **Material Design 3 — Data Visualization** —
  https://m3.material.io/foundations/content-design/data-visualization