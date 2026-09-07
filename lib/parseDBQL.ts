import type { MongoFilter, DBQLTerm } from '@/types/dbql';

export function buildMongoCondition(term: DBQLTerm): MongoFilter {
  const { key, value, isNot } = term;
  const condition: MongoFilter = {};

  // Converte valores para tipos adequados
  let parsedValue: any = value;
  if (value === 'true') parsedValue = true;
  else if (value === 'false') parsedValue = false;
  else if (!isNaN(Number(value)) && value.trim() !== '') parsedValue = Number(value);

  // Se houver wildcard, usa regex
  if (typeof parsedValue === 'string' && parsedValue.includes('*')) {
    const escaped = parsedValue.replace(/([.+?^${}()|[\]\\])/g, '\\$1').replace(/\*/g, '.*');
    const regexPattern = `^${escaped}$`;
    if (isNot) condition[key] = { $not: { $regex: regexPattern, $options: 'i' } } as any;
    else condition[key] = { $regex: regexPattern, $options: 'i' } as any;
  } else {
    if (isNot) condition[key] = { $ne: parsedValue } as any;
    else condition[key] = parsedValue;
  }
  return condition;
}

export function negateExpression(expr: MongoFilter): MongoFilter {
  if (!expr || Object.keys(expr).length === 0) return {};
  if (expr.$or) return { $nor: expr.$or };
  if (expr.$and) return { $or: expr.$and.map(negateExpression) };

  const keys = Object.keys(expr);
  if (keys.length === 1) {
    const field = keys[0];
    const val = expr[field];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const objVal = val as Record<string, unknown>;
      if (objVal.$regex) return { [field]: { $not: { $regex: objVal.$regex, $options: objVal.$options || 'i' } } } as any;
      if (objVal.$ne !== undefined) return { [field]: objVal.$ne } as any;
    } else {
      return { [field]: { $ne: val } } as any;
    }
  }
  return { $nor: [expr] } as any;
}

export function parseDBQL(queryString: string): MongoFilter | null {
  if (!queryString?.trim()) return null;
  const queryStr = queryString.trim();

  // Tokenização robusta: aceita ponto em campos, operadores de comparação, aspas
  function tokenize(str: string): string[] {
    const regex =
      /\s*(AND|OR|NOT|!|\(|\)|!?[a-zA-Z0-9_.]+(?:>=|<=|>|<|!=|:|=)(?:"[^"]*"|\S+))\s*/gi;
    const tokens: string[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        const unparsed = str.substring(lastIndex, match.index).trim();
        if (unparsed) tokens.push(unparsed);
      }
      if (match[1]) tokens.push(match[1]);
      lastIndex = regex.lastIndex;
    }

    // Separa parênteses grudados em tokens
    const expanded: string[] = [];
    for (const t of tokens) {
      if (t !== ')' && t.endsWith(')')) {
        let clean = t;
        const closing: string[] = [];
        while (clean.endsWith(')') && clean.length > 1 && !clean.endsWith('"')) {
          closing.unshift(')');
          clean = clean.slice(0, -1);
        }
        if (closing.length > 0) {
          if (clean) expanded.push(clean);
          expanded.push(...closing);
          continue;
        }
      }
      expanded.push(t);
    }
    return expanded;
  }

  const tokens = tokenize(queryStr);
  if (tokens.length === 0) return null;
  let tokenIndex = 0;

  // Parser com precedência: AND > OR
  function parseOr(): MongoFilter {
    let left = parseAnd();
    while (tokenIndex < tokens.length) {
      const op = tokens[tokenIndex]?.toUpperCase();
      if (op !== 'OR') break;
      tokenIndex++;
      const right = parseAnd();
      left = { $or: [left, right] };
    }
    return left;
  }

  function parseAnd(): MongoFilter {
    let left = parseTerm();
    while (tokenIndex < tokens.length) {
      const op = tokens[tokenIndex]?.toUpperCase();
      if (op !== 'AND') break;
      tokenIndex++;
      const right = parseTerm();
      left = { $and: [left, right] };
    }
    return left;
  }

  function parseTerm(): MongoFilter {
    if (tokenIndex >= tokens.length) return {};
    const token = tokens[tokenIndex];

    if (token === '(') {
      tokenIndex++;
      const expr = parseOr();
      if (tokens[tokenIndex] === ')') tokenIndex++;
      return expr;
    }

    if (token === '!' || token?.toUpperCase() === 'NOT') {
      tokenIndex++;
      return negateExpression(parseTerm());
    }

    tokenIndex++;

    // Captura campos com ponto e operadores de comparação
    const m = token?.match(
      /^(!?)([a-zA-Z0-9_.]+)(>=|<=|>|<|!=|:|=)(?:"([^"]*)"|(\S+))$/
    );
    if (m) {
      const key = m[2];
      const op = m[3];
      const rawValue = m[4] ?? m[5] ?? '';
      let value: any = rawValue;

      // Remove aspas se presente
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      // Converte tipos
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(Number(value)) && value.trim() !== '') value = Number(value);

      const isNot = m[1] === '!';

      // Monta filtro conforme operador
      let condition: MongoFilter = {};
      switch (op) {
        case ':':
        case '=':
          condition = buildMongoCondition({ key, value: String(value), isNot });
          break;
        case '!=':
          condition = { [key]: { $ne: value } } as any;
          if (isNot) condition = { [key]: value } as any; // !!dupla negação
          break;
        case '>':
          condition = { [key]: { $gt: value } } as any;
          break;
        case '>=':
          condition = { [key]: { $gte: value } } as any;
          break;
        case '<':
          condition = { [key]: { $lt: value } } as any;
          break;
        case '<=':
          condition = { [key]: { $lte: value } } as any;
          break;
      }

      // Aplica NOT se necessário
      if (isNot && op !== ':') {
        return negateExpression(condition);
      }
      return condition;
    }

    // Fallback: se não for um campo, trata como texto solto (regex simples)
    return { $text: { $search: token } } as any;
  }

  try {
    return parseOr();
  } catch {
    return null;
  }
}