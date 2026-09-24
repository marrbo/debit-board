# Sintaxe DBQL

> **ATENÇÃO:** DBQL **não é SQL**. Nunca gere `SELECT`, `FROM`, `WHERE`,
> `JOIN` ou qualquer palavra-chave de SQL. DBQL é uma linguagem proprietária
> do DebitBoard com apenas um operador estrutural: `propriedade:valor`.

DBQL é a linguagem de consulta do DebitBoard.

Formato básico: `propriedade:valor` com dois-pontos. Nunca use `=`.

Exemplos corretos:

- `category:"Broken Access Control"`
- `status:open`
- `severity:critical`
- `category:"Broken Access Control" AND status:open AND branch:main`
- `project:GEPIN AND NOT status:resolved`
- `category:"Broken Access Control" AND (status:open OR status:resolved)`
- `!category:"Broken Access Control"`

Aspas duplas só quando o valor tem espaço. `AND`, `OR`, `NOT`, `!`, `( )`, `*`.

Campos em observations: `category`, `severity`, `status`, `branch`, `project`,
`repository`, `is`, `fileName`.
