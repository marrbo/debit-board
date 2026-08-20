# Sintaxe da DBQL (Debit Board Query Language)

A **Debit Board Query Language (DBQL)** é uma linguagem de consulta poderosa e flexível inspirada nas melhores ferramentas de observabilidade do mercado. Ela permite que você filtre e localize *Issues* de segurança com precisão cirúrgica, utilizando uma combinação de filtros por propriedades, operadores lógicos e agrupamentos.

Esta página serve como a **referência técnica oficial** da sintaxe. Para ver exemplos práticos de uso, consulte a [página de Exemplos DBQL](/wiki/dbql/examples).

---

## 🔍 Estrutura Básica de uma Consulta

Uma consulta DBQL é composta por **propriedades**, **operadores** e **valores**.

A sintaxe fundamental é baseada no padrão:

```sql
propriedade:valor
```

*   **`propriedade`**: O campo (ou metadado) que você deseja filtrar (ex: `severity`).
*   **`:`**: O separador obrigatório entre a propriedade e o seu valor.
*   **`valor`**: O conteúdo a ser buscado. Valores com espaços ou caracteres especiais devem ser envolvidos em **aspas duplas** (`" "`).

> **Exemplo:** `category:"Broken Access Control"` (busca por issues exatamente com essa categoria).

---

## 📋 Propriedades Disponíveis

Abaixo estão todas as propriedades que podem ser utilizadas para filtrar os dados no DebitBoard.

| Propriedade | Descrição | Tipo de Valor | Exemplo |
| :--- | :--- | :--- | :--- |
| `category` | Categoria da vulnerabilidade (ex: SQL Injection, XSS). | Texto (use `""` para espaços) | `category:"Broken Access Control"` |
| `severity` | Nível de severidade da vulnerabilidade. | `critical`, `high`, `medium`, `low` | `severity:critical` |
| `branch` | Nome do branch do repositório onde a Issue foi encontrada. | Texto (geralmente sem aspas) | `branch:main` |
| `project` | Nome do projeto dentro da organização/tenant. | Texto | `project:GEPIN_AS` |
| `repository` | Nome do repositório específico. | Texto | `repository:my-backend-api` |
| `status` | Status atual do ciclo de vida da Issue. | `open`, `fixed`, `recurring`, `wont_fix` | `status:open` |
| `is` | Filtros de estado especiais para a Issue. | `unresolved` (Abertas ou recorrentes) | `is:unresolved` |
| `fileName` | Nome do arquivo onde a Issue foi identificada. | Texto, suporta **curingas** (`*`) | `fileName:*Controller.cs` |

---

## ⚙️ Operadores Lógicos e Símbolos

Combine múltiplas propriedades e condições utilizando os seguintes operadores e símbolos.

| Operador | Descrição | Precedência | Exemplo |
| :--- | :--- | :--- | :--- |
| `AND` | **E lógico**: A consulta exige que **ambas** as condições sejam verdadeiras. | Alta | `branch:main AND severity:critical` |
| `OR` | **OU lógico**: A consulta aceita que **pelo menos uma** das condições seja verdadeira. | Média | `severity:high OR severity:critical` |
| `NOT` | **NÃO lógico (negação)**: A consulta **exclui** os resultados que atendem a condição especificada. | Alta | `NOT branch:main` |
| `!` | **NEGAÇÃO (atalho)**: Funciona exatamente como o `NOT`, porém é mais conciso. | Alta | `!branch:main` |
| `( )` | **Agrupamento**: Permite agrupar condições para forçar uma ordem de execução específica. | Muito Alta | `(severity:high OR severity:critical)` |
| `*` | **Curinga (Wildcard)**: Substitui qualquer conjunto de caracteres dentro do valor de uma propriedade. | Aplicado ao valor | `fileName:*Controller.cs` |

---

## 🧠 Utilizando Operadores e Agrupamentos

A DBQL executa as consultas baseadas em precedência de operadores, onde `AND` e `NOT` são avaliados antes do `OR`. No entanto, **é uma boa prática sempre utilizar parênteses `( )` ao misturar `AND` e `OR`**, para garantir que sua intenção seja clara e executada corretamente.

### Negação com `!` ou `NOT`
Para excluir um resultado específico, utilize `!` ou `NOT` antes da propriedade.

```sql
!branch:develop
# OU
NOT branch:develop
```

### Agrupamento com `( )`
Para buscar issues que atendam a um grupo de condições distintas (como High OU Critical), dentro de um mesmo contexto:

```sql
(severity:critical OR severity:high)
```

### Combinação Avançada
Você pode encadear lógicas complexas.

```sql
!branch:main AND (severity:critical OR severity:high) AND fileName:*Controller.cs
```
*Interpretação:* Exclui a branch `main`, filtra apenas as severidades `critical` ou `high`, e busca apenas arquivos que terminam em `Controller.cs`.

---

## ⭐ Regras de Precedência (Ordem de Execução)

1. `( )` - Parênteses possuem a **maior prioridade** e são executados primeiro.
2. `!` ou `NOT` - A negação é avaliada antes dos operadores relacionais.
3. `AND` - O E lógico é avaliado antes do OU.
4. `OR` - O OU lógico é o último a ser avaliado.

> **💡 Dica Profissional:** Como as regras podem variar de acordo com o contexto, sempre agrupe as suas condições `OR` dentro de parênteses quando combiná-las com `AND`. Exemplo: `project:A AND (severity:high OR severity:critical)` é muito mais seguro que `project:A AND severity:high OR severity:critical`.

---

## 💡 Sintaxe de Valores e Curingas

### Valores com Espaços
Se o valor de uma propriedade contiver espaços, você **deve** envolvê-lo em aspas duplas (`"`). O mesmo se aplica a caracteres especiais.

**Incorreto:** `category:Broken Access Control` (O sistema tentará buscar "Broken" ou "Access" separadamente).
**Correto:** `category:"Broken Access Control"`

### O Curinga `*`
O asterisco `*` é extremamente útil para buscas abrangentes. Ele pode ser usado no início, no meio ou no final de um termo de busca.

*   `fileName:*Controller.cs` : Busca qualquer arquivo que termine com `Controller.cs`.
*   `fileName:Service*.ts` : Busca qualquer arquivo que comece com `Service` e termine com `.ts`.
*   `fileName:*models*` : Busca qualquer arquivo que contenha `models` no caminho.

---

## 🏁 Resumo Visual

```sql
[!] ( [propriedade]:[valor] [AND|OR] [propriedade]:[valor] )
```

*   **Busca por severidade crítica ou alta:** `severity:critical OR severity:high`
*   **Busca por SQL Injection aberto:** `category:"SQL Injection" AND status:open`
*   **Busca com negação e curinga:** `!branch:main AND fileName:*Repository.cs`

---

*A DBQL é uma ferramenta em constante evolução. Para saber mais sobre as últimas novidades, consulte sempre a documentação atualizada.*