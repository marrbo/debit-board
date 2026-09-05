import type { MongoFilter, DBQLTerm } from '@/types/dbql';

export function buildMongoCondition(term: DBQLTerm): MongoFilter {
  const { key, value, isNot } = term;
  const condition: MongoFilter = {};

  if (value.includes('*')) {
    const escaped = value.replace(/([.+?^${}()|[\]\\])/g, '\\$1').replace(/\*/g, '.*');
    const regexPattern = `^${escaped}$`;
    if (isNot) condition[key] = { $not: { $regex: regexPattern, $options: 'i' } } as any;
    else condition[key] = { $regex: regexPattern, $options: 'i' } as any;
  } else {
    if (isNot) condition[key] = { $ne: value } as any;
    else condition[key] = value;
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

  function tokenize(str: string): string[] {
    const regex = /\s*(AND|OR|NOT|!|\(|\)|!?[a-zA-Z0-9_]+:(?:"[^"]*"|\S+))\s*/gi;
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
    const expanded: string[] = [];
    for (const t of tokens) {
      if (t !== ')' && t.endsWith(')')) {
        let clean = t;
        const closing: string[] = [];
        while (clean.endsWith(')') && clean.length > 1 && !clean.endsWith('"')) {
          closing.unshift(')');
          clean = clean.slice(0, -1);
        }
        if (closing.length > 0) { expanded.push(clean); expanded.push(...closing); continue; }
      }
      expanded.push(t);
    }
    return expanded;
  }

  const tokens = tokenize(queryStr);
  if (tokens.length === 0) return null;
  let tokenIndex = 0;

  function parseExpression(): MongoFilter {
    let left = parseTerm();
    while (tokenIndex < tokens.length) {
      const operator = tokens[tokenIndex]?.toUpperCase();
      if (operator === 'OR' || operator === 'AND') {
        tokenIndex++;
        const right = parseTerm();
        left = operator === 'OR' ? { $or: [left, right] } : { $and: [left, right] };
      } else break;
    }
    return left;
  }

  function parseTerm(): MongoFilter {
    if (tokenIndex >= tokens.length) return {};
    const token = tokens[tokenIndex];
    if (token === '(') {
      tokenIndex++;
      const expr = parseExpression();
      if (tokens[tokenIndex] === ')') tokenIndex++;
      return expr;
    }
    if (token === '!' || token?.toUpperCase() === 'NOT') {
      tokenIndex++;
      return negateExpression(parseTerm());
    }
    tokenIndex++;
    const m = token?.match(/^(!?)(\w+):(?:"([^"]*)"|(\S+))$/);
    if (m) return buildMongoCondition({ isNot: m[1] === '!', key: m[2] || '', value: m[3] || m[4] || '' });
    return {};
  }

  try { return parseExpression(); } catch { return null; }
}
