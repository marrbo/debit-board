// /lib/parseDBQL.ts

// 🔥 PARSER DBQL COMPLETO: Suporte a OR, AND, NOT, ! e Parênteses com recursão
// 🛠️ Função auxiliar para converter um termo individual (ex: branch:main ou !fileName:*Test*) em objeto do MongoDB
export function buildMongoCondition(isNot: boolean, key: string, rawValue: string): any {
  const condition: any = {};

  if (rawValue.includes('*')) {
    const escaped = rawValue.replace(/([.+?^${}()|[\]\\])/g, '\\$1').replace(/\*/g, '.*');
    const regexPattern = `^${escaped}$`;
    
    if (isNot) {
      condition[key] = { $not: { $regex: regexPattern, $options: 'i' } };
    } else {
      condition[key] = { $regex: regexPattern, $options: 'i' };
    }
  } else {
    if (isNot) {
      condition[key] = { $ne: rawValue };
    } else {
      condition[key] = rawValue;
    }
  }
  return condition;
}

// 🛠️ Função para negar expressões complexas (evita erro do MongoDB com $not em operadores lógicos)
export function negateExpression(expr: any): any {
  if (!expr) return {};
  if (expr.$or) {
    return { $nor: expr.$or };
  }
  if (expr.$and) {
    return { $or: expr.$and.map(negateExpression) };
  }
  const keys = Object.keys(expr);
  if (keys.length === 1) {
    const field = keys[0] || '';
    const val = expr[field];
    if (val && typeof val === 'object') {
      if (val.$regex) {
        return { [field]: { $not: { $regex: val.$regex, $options: val.$options || 'i' } } };
      }
      if (val.$ne !== undefined) {
        return { [field]: val.$ne };
      }
    } else {
      return { [field]: { $ne: val } };
    }
  }
  return { $nor: [expr] };
}

// 🔥 PARSER DBQL COMPLETO: Suporte a OR, AND, NOT, ! e Parênteses com recursão
export function parseDBQL(queryString: string): any {
  if (!queryString || !queryString.trim()) return null;

  const queryStr = queryString.trim();

  // Função interna para tokenizar a string respeitando parênteses e operadores lógicos
  function tokenize(str: string) {
    const regex = /\s*(AND|OR|NOT|!|\(|\)|!?[a-zA-Z0-9_]+:(?:"[^"]*"|\S+))\s*/gi;
    const tokens: string[] = [];
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        const unparsed = str.substring(lastIndex, match.index).trim();
        if (unparsed) tokens.push(unparsed);
      }
      if (match[1]) {
        tokens.push(match[1]);
      }
      lastIndex = regex.lastIndex;
    }

    // 🔥 Pós-processamento: Separa parênteses de fechamento grudados em valores (ex: branch:master))
    const expandedTokens: string[] = [];
    for (const t of tokens) {
      if (t !== ')' && t.endsWith(')')) {
        let clean = t;
        const closingParens: string[] = [];
        while (clean.endsWith(')') && clean.length > 1 && !clean.endsWith('"')) {
          closingParens.unshift(')');
          clean = clean.slice(0, -1);
        }
        if (closingParens.length > 0) {
          expandedTokens.push(clean);
          expandedTokens.push(...closingParens);
          continue;
        }
      }
      expandedTokens.push(t);
    }

    return expandedTokens;
  }

  const tokens = tokenize(queryStr);
  if (tokens.length === 0) return null;

  let tokenIndex = 0;

  function parseExpression(): any {
    let left = parseTerm();

    while (tokenIndex < tokens.length) {
      const operator = tokens[tokenIndex]?.toUpperCase();
      if (operator === 'OR' || operator === 'AND') {
        tokenIndex++; // consome o operador
        const right = parseTerm();
        if (operator === 'OR') {
          left = { $or: [left, right] };
        } else {
          left = { $and: [left, right] };
        }
      } else {
        break;
      }
    }
    return left;
  }

  function parseTerm(): any {
    if (tokenIndex >= tokens.length) return {};

    const token = tokens[tokenIndex];

    // Tratamento de Parênteses (Agrupamento)
    if (token === '(') {
      tokenIndex++; // consome '('
      const expr = parseExpression();
      if (tokens[tokenIndex] === ')') {
        tokenIndex++; // consome ')'
      }
      return expr;
    }

    // Tratamento de operador NOT unário ou '!'
    if (token === '!' || token?.toUpperCase() === 'NOT') {
      tokenIndex++; // consome '!' ou 'NOT'
      const subExpr = parseTerm();
      return negateExpression(subExpr);
    }

    // Tratamento de termo folha (campo:valor ou !campo:valor)
    tokenIndex++;
    const termMatch = token?.match(/^(!?)(\w+):(?:"([^"]*)"|(\S+))$/);
    if (termMatch) {
      const isNot = termMatch[1] === '!';
      const key = termMatch[2] || '';
      const value = termMatch[3] || termMatch[4];
      return buildMongoCondition(isNot, key, value || '');
    }

    // Fallback caso encontre token avulso
    return {};
  }

  try {
    const result = parseExpression();
    return result;
  } catch (e) {
    console.error('❌ Erro no parser DBQL avançado:', e);
    return null;
  }
}