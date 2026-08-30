// lib/searchParser.ts

export const FIELD_MAP: Record<string, string> = {
  category: 'category',
  branch: 'branch',
  status: 'status',
  severity: 'severity',
  assigned: 'assignedTo',
  project: 'project',
  repository: 'repository',
  repo: 'repository',
  sla: 'slaHours',
  is: 'status',
};

// 🔥 Tokenizador inteligente para DQL avançada com parênteses
function tokenize(searchStr: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < searchStr.length; i++) {
    const char = searchStr[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ' ' && !inQuotes) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    if (char === '(' && !inQuotes) {
      if (current) tokens.push(current);
      tokens.push('(');
      current = '';
      continue;
    }
    if (char === ')' && !inQuotes) {
      if (current) tokens.push(current);
      tokens.push(')');
      current = '';
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

// 🔥 Converte um termo simples em um filtro MongoDB, tratando `!` e `*`
function parseCondition(token: string): any {
  let isNegated = false;

  // Verifica se o token começa com `!`
  if (token.startsWith('!')) {
    isNegated = true;
    token = token.substring(1);
  }

  const colonIndex = token.indexOf(':');
  let condition: any;

  if (colonIndex > 0) {
    const key = token.substring(0, colonIndex);
    let value = token.substring(colonIndex + 1);

    // 🔥 Substitui `*` por `.*` para suportar Wildcards no Regex
    if (value.includes('*')) {
      value = value.replace(/\*/g, '.*');
      condition = { [FIELD_MAP[key] || key]: { $regex: value, $options: 'i' } };
    } else {
      condition = { [FIELD_MAP[key] || key]: value };
    }
  } else {
    condition = {
      $or: [
        { fileName: { $regex: token, $options: 'i' } },
        { filePath: { $regex: token, $options: 'i' } },
        { query: { $regex: token, $options: 'i' } },
      ]
    };
  }

  // Se for negado (`!`), aplica o operador `$nor` diretamente
  if (isNegated) {
    return { $nor: [condition] };
  }

  return condition;
}

// 🔥 Algoritmo Shunting-yard para construir a RPN (Notação Polonesa Reversa)
function toRPN(tokens: string[]): string[] {
  const output: string[] = [];
  const operators: string[] = [];
  const precedence: Record<string, number> = { 'NOT': 3, 'AND': 2, 'OR': 1 };

  for (const token of tokens) {
    if (token === '(') {
      operators.push(token);
    } else if (token === ')') {
      while (operators.length && operators[operators.length - 1] !== '(') {
        output.push(operators.pop()!);
      }
      operators.pop(); // Remove o '('
    } else if (['AND', 'OR', 'NOT'].includes(token)) {
      while (
        operators.length &&
        operators[operators.length - 1] !== '(' &&
        precedence[operators[operators.length - 1]] >= precedence[token]
      ) {
        output.push(operators.pop()!);
      }
      operators.push(token);
    } else {
      // É um termo de busca (ex: branch:main, fileName:*Controller.cs)
      output.push(token);
    }
  }

  while (operators.length) {
    output.push(operators.pop()!);
  }

  return output;
}

// 🔥 Avalia a RPN e constrói o filtro MongoDB
function evaluateRPN(rpn: string[], existingFilter: any): any {
  const stack: any[] = [];

  for (const token of rpn) {
    if (['AND', 'OR', 'NOT'].includes(token)) {
      if (token === 'NOT') {
        const operand = stack.pop();
        // Como o `!` já foi tratado no parseCondition, aqui garantimos a lógica invertida
        stack.push({ $nor: [operand] });
      } else if (token === 'AND') {
        const right = stack.pop();
        const left = stack.pop();
        stack.push({ $and: [left, right] });
      } else if (token === 'OR') {
        const right = stack.pop();
        const left = stack.pop();
        stack.push({ $or: [left, right] });
      }
    } else {
      stack.push(parseCondition(token));
    }
  }

  return { ...existingFilter, ...stack[0] };
}

// 🔥 Função principal de análise (usada pelas rotas de API)
export function parseSearchQuery(searchStr: string, existingFilter: any) {
  if (!searchStr) return existingFilter;

  const tokens = tokenize(searchStr);
  const rpn = toRPN(tokens);
  return evaluateRPN(rpn, existingFilter);
}