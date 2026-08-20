// app/api/observations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Issue } from '@/models/Issue';
import { VulnerabilityPattern } from '@/models/VulnerabilityPattern'; 
import { getServerAuthSession } from '@/lib/auth';

// 🛠️ Função auxiliar para converter um termo individual (ex: branch:main ou !fileName:*Test*) em objeto do MongoDB
function buildMongoCondition(isNot: boolean, key: string, rawValue: string): any {
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

// 🔥 PARSER DBQL COMPLETO: Suporte a OR, AND, NOT, ! e Parênteses com recursão
function parseDBQL(queryString: string): any {
  if (!queryString || !queryString.trim()) return null;

  // Normaliza espaços extras
  const queryStr = queryString.trim();

  // Função interna para tokenizar a string respeitando parênteses e operadores lógicos
  function tokenize(str: string) {
    const regex = /\s*(AND|OR|NOT|\(|\)|!?[a-zA-Z0-9_]+:(?:"[^"]*"|\S+))\s*/gi;
    const tokens: string[] = [];
    let match;
    let lastIndex = 0;

    // Garante que pegamos todos os tokens válidos
    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        // Se houver caracteres inesperados significativos entre os tokens, tratamos
        const unparsed = str.substring(lastIndex, match.index).trim();
        if (unparsed) tokens.push(unparsed);
      }
      tokens.push(match[1]);
      lastIndex = regex.lastIndex;
    }
    return tokens;
  }

  const tokens = tokenize(queryStr);
  if (tokens.length === 0) return null;

  let tokenIndex = 0;

  function parseExpression(): any {
    let left = parseTerm();

    while (tokenIndex < tokens.length) {
      const operator = tokens[tokenIndex].toUpperCase();
      if (operator === 'OR' || operator === 'AND') {
        tokenIndex++; // consome o operador
        const right = parseTerm();
        if (operator === 'OR') {
          left = { $or: [left, right] };
        } else {
          // AND implícito ou explícito
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

    // Tratamento de operador NOT unário
    if (token.toUpperCase() === 'NOT') {
      tokenIndex++; // consome 'NOT'
      const subExpr = parseTerm();
      // Inverte a condição aplicando $nor ou negando o objeto
      return { $not: subExpr };
    }

    // Tratamento de termo folha (campo:valor ou !campo:valor)
    tokenIndex++;
    const termMatch = token.match(/^(!?)(\w+):(?:"([^"]*)"|(\S+))$/);
    if (termMatch) {
      const isNot = termMatch[1] === '!';
      const key = termMatch[2];
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

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const category = searchParams.get('category') || '';
    const branch = searchParams.get('branch') || '';
    const severity = searchParams.get('severity') || '';
    const projectId = searchParams.get('projectId') || '';
    const all = searchParams.get('all') === 'true';

    if (id) {
      let issue = await Issue.findById(id).lean();
      if (!issue || issue.tenantId !== session.user.tenantId) {
        return NextResponse.json({ error: 'Issue não encontrada.' }, { status: 404 });
      }

      if (issue.patternId && typeof issue.patternId === 'string' && issue.patternId.length > 0) {
        const pattern = await VulnerabilityPattern.findById(issue.patternId).lean();
        issue.patternId = pattern || null; 
      } else {
        issue.patternId = null;
      }
      return NextResponse.json(issue);
    }

    const query: any = { tenantId: session.user.tenantId };
    if (status) query.status = status;
    if (category) query.category = category;
    if (branch) query.branch = branch;
    if (severity) query.severity = severity;
    if (projectId) query.project = projectId;

    // 🔥 APLICAÇÃO DA ÁRVORE DBQL GERADA PELO PARSER RECURSIVO
    if (search) {
      const dbqlParsedQuery = parseDBQL(search);
      if (dbqlParsedQuery && Object.keys(dbqlParsedQuery).length > 0) {
        // Mescla as condições da DBQL com o tenantId obrigatório usando $and
        query.$and = [
          { tenantId: session.user.tenantId },
          dbqlParsedQuery
        ];
        // Remove o tenantId raiz duplicado para evitar conflito na query final do Mongoose
        delete query.tenantId;
      } else {
        // Fallback de texto livre caso a query não siga o padrão DBQL
        query.$or = [
          { fileName: { $regex: search, $options: 'i' } },
          { filePath: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
          { project: { $regex: search, $options: 'i' } },
          { repository: { $regex: search, $options: 'i' } },
          { branch: { $regex: search, $options: 'i' } },
          { status: { $regex: search, $options: 'i' } },
          { severity: { $regex: search, $options: 'i' } },
        ];
      }
    }

    const skip = (page - 1) * limit;

    if (all) {
      const allIssues = await Issue.find(query).sort({ firstSeen: -1 }).lean();
      return NextResponse.json({ issues: allIssues });
    }

    const [issues, total] = await Promise.all([
      Issue.find(query).sort({ firstSeen: -1 }).skip(skip).limit(limit).lean(),
      Issue.countDocuments(query)
    ]);

    return NextResponse.json({
      issues,
      totalPages: Math.ceil(total / limit),
    });

  } catch (error: any) {
    console.error('❌ Erro fatal na API de Issues:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}