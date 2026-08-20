// app/api/observations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Issue } from '@/models/Issue';
import { VulnerabilityPattern } from '@/models/VulnerabilityPattern'; 
import { getServerAuthSession } from '@/lib/auth';

// 🔥 PARSER DBQL APRIMORADO: Suporta wildcards (*) e conversão para regex
function parseDBQL(queryString: string): any[] | null {
  const conditions: any[] = [];

  // Expressão regular para extrair: (opcional !) + (campo) + : + ("valor entre aspas" ou valor sem espaço)
  const termRegex = /(?:^|\s)(!?)(\w+):(?:"([^"]*)"|(\S+))/g;
  let match;

  let tempQuery = queryString;
  let matchFound = false;

  while ((match = termRegex.exec(tempQuery)) !== null) {
    matchFound = true;
    const isNot = match[1] === '!';
    const key = match[2];
    const rawValue = match[3] || match[4]; 

    if (!rawValue) continue;

    const condition: any = {};

    // Verifica se o valor contém o caractere curinga (*)
    if (rawValue.includes('*')) {
      // Converte o coringa '*' em expressão regular '.*' e escapa caracteres especiais do regex (exceto o *)
      const escaped = rawValue.replace(/([.+?^${}()|[\]\\])/g, '\\$1').replace(/\*/g, '.*');
      // Garante correspondência em toda a string (^...$)
      const regexPattern = `^${escaped}$`;
      
      if (isNot) {
        condition[key] = { $not: { $regex: regexPattern, $options: 'i' } };
      } else {
        condition[key] = { $regex: regexPattern, $options: 'i' };
      }
    } else {
      // Busca exata (mas case-insensitive ou direta conforme sua preferência, mantendo a lógica anterior)
      if (isNot) {
        condition[key] = { $ne: rawValue };
      } else {
        condition[key] = rawValue;
      }
    }

    conditions.push(condition);
  }

  return matchFound ? conditions : null;
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

    // 🔥 APLICAÇÃO DA BUSCA COM PARSER DBQL ATUALIZADO
    if (search) {
      const dbqlConditions = parseDBQL(search);
      if (dbqlConditions && dbqlConditions.length > 0) {
        query.$and = dbqlConditions;
      } else {
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