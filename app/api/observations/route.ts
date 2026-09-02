// app/api/observations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Observation } from '@/models/Observation';
import { VulnerabilityPattern } from '@/models/VulnerabilityPattern'; 
import '@/utils/mongooseExtensions';
import type { ObjectId } from 'mongoose';
import { parseDBQL } from '@/lib/parseDBQL';
import * as Sentry from '@sentry/nextjs';
import { User } from '@/models/User';

    // Função para converter nomes de usuários em subs
async function convertAssignedToSubs(query: string): Promise<string> {
  if (!query.includes('assignedTo:')) return query;

  // Regex para capturar padrão "assignedTo:valor"
  const regex = /assignedTo:\s*(?:"([^"]*)"|([^\s()]+))/gi
  const matches = query.match(regex);

  if (!matches) return query;

  // Para cada ocorrência, substituir
  for (const match of matches) {
    const matchArray = match?.split(':');
    if (matchArray?.length > 0 && matchArray[1]) {
      const value = matchArray[1].replace(/"/g, '');

      // Buscar usuário por nome ou email
      const users = await (User as any).find({
        $or: [
          { name: { $regex: `^${value}$`, $options: 'i' } },
          { email: { $regex: `^${value}$`, $options: 'i' } },
        ],
      }).select('sub').lean();

      const subs = users.map((u: any) => u.sub);
      if (subs.length > 0) {
        // Substituir por uma expressão OR com os subs
        const replacement = subs.length === 1
          ? `assignedTo:${subs[0]}`
          : `assignedTo:${subs.join(' OR assignedTo:')}`;

        query = query.replace(match, replacement);
      }
    }
  }

  return query;
}

export async function GET(req: NextRequest) {
  let response_time = Date.now();

  const tenantId = req.headers.get('x-tenant-id');

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
      const issue = await Observation.findById(id).lean();
      if (!issue || issue.tenantId !== tenantId) {
        return NextResponse.json({ error: 'Issue não encontrada.' }, { status: 404 });
      }

      if (issue.patternId && issue?.patternId?.isValidAndNotNull() ) {
        const pattern = await VulnerabilityPattern.findById<ObjectId>(issue.patternId).lean();
        issue.patternId = pattern._id;
      } else {
        issue.pattern = null;
      }
      return NextResponse.json(issue);
    }

    const DBQLQuery: any = { tenantId: tenantId };
    if (status) DBQLQuery.status = status;
    if (category) DBQLQuery.category = category;
    if (branch) DBQLQuery.branch = branch;
    if (severity) DBQLQuery.severity = severity;
    if (projectId) DBQLQuery.project = projectId;

    // 🔥 APLICAÇÃO DA ÁRVORE DBQL GERADA PELO PARSER RECURSIVO
    if (search) {
      const searchWithSubs = await convertAssignedToSubs(search);
      const dbqlParsedQuery = parseDBQL(searchWithSubs);
      if (dbqlParsedQuery && Object.keys(dbqlParsedQuery).length > 0) {
        DBQLQuery.$and = [
          { tenantId: tenantId },
          dbqlParsedQuery
        ];
        delete DBQLQuery.tenantId;
      } else {
        DBQLQuery.$or = [
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

    // Se for all=true, retorna tudo sem paginação
    if (all) {
      const allObservations = await Observation.find(DBQLQuery).sort({ firstSeen: -1 }).lean();
      return NextResponse.json({ observations: allObservations });
    }

    const [observations, total] = await Promise.all([
      Observation.find(DBQLQuery).sort({ firstSeen: -1 }).skip(skip).limit(limit).lean(),
      Observation.countDocuments(DBQLQuery)
    ]);

    return NextResponse.json({
      observations,
      page,              // ← página atual
      limit,             // ← itens por página
      total,             // ← total de itens
      totalPages: Math.ceil(total / limit),
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('❌ Erro fatal na API de Observations:', message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    response_time = Date.now() - response_time;
    Sentry.metrics.distribution('api_response_time', response_time);
  }
}

// app/api/observations/route.ts

export async function PATCH(req: NextRequest) {
  const tenantId = req.headers.get('x-tenant-id');

  try {
    await connectToDatabase();
    const body = await req.json();
    const { issueId, assignedTo } = body;

    if (!issueId) {
      return NextResponse.json({ error: 'ID da observation é obrigatório.' }, { status: 400 });
    }

    // Busca a observation e verifica se pertence ao tenant
    const observation = await Observation.findOne({ _id: issueId, tenantId });

    if (!observation) {
      return NextResponse.json({ error: 'Observation não encontrada.' }, { status: 404 });
    }

    // Atualiza o campo assignedTo (pode ser string ou null)
    observation.assignedTo = assignedTo ?? undefined; // ou null, dependendo do modelo
    await observation.save();

    return NextResponse.json(observation, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('❌ Erro ao atualizar observation:', message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}