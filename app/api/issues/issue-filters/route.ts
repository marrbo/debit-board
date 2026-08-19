// app/api/issue-filters/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Project } from '@/models/Project';
import { Repository } from '@/models/Repository';
import { Issue } from '@/models/Issue';
import { getServerAuthSession } from '@/lib/auth';
import { PipelineStage } from 'mongoose';

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const { searchParams } = new URL(req.url);
  const field = searchParams.get('field');
  const query = searchParams.get('query') || '';
  const context = searchParams.get('context') || 'issues'; // <-- Novo parâmetro

  // Mapa de campos por contexto
  const ALLOWED_FIELDS: Record<string, string[]> = {
    issues: ['category', 'severity', 'branch', 'project', 'repository', 'status', 'is'],
    stats: ['category', 'severity', 'branch', 'project', 'repository', 'status', 'is'], // Stats reusa os mesmos
    projects: ['name', 'teamIds'],
    repositories: ['name', 'projectId'],
  };

  const allowedFields = ALLOWED_FIELDS[context] || [];
  if (!field || !allowedFields.includes(field)) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    let suggestions: string[] = [];

    // 🔥 Lógica dinâmica baseada no contexto e no campo
    if (context === 'issues' || context === 'stats') {
      const regex = new RegExp(query, 'i');
      const pipeline: PipelineStage[] = [
        { $match: { tenantId: session.user.tenantId, [field]: { $regex: regex } } },
        { $group: { _id: `$${field}` } },
        { $limit: 10 },
        { $sort: { _id: 1 } }
      ];
      const results = await Issue.aggregate(pipeline);
      suggestions = results.map((r: any) => r._id).filter(Boolean);
    } 
    else if (context === 'projects') {
      const regex = new RegExp(query, 'i');
      const results = await Project.find({ tenantId: session.user.tenantId, [field]: { $regex: regex } }).limit(10).select(field).lean();
      suggestions = results.map((r: any) => r[field]).filter(Boolean);
    } 
    else if (context === 'repositories') {
      const regex = new RegExp(query, 'i');
      const results = await Repository.find({ tenantId: session.user.tenantId, [field]: { $regex: regex } }).limit(10).select(field).lean();
      suggestions = results.map((r: any) => r[field]).filter(Boolean);
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Erro ao buscar sugestões:', error);
    return NextResponse.json({ suggestions: [] });
  }
}