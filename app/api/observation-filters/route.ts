// app/api/observation-filters/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Observation } from '@/models/Observation';
import { getServerAuthSession } from '@/lib/auth';
import { PipelineStage } from 'mongoose';

// Mapeamento de alias de campos amigáveis para campos reais do MongoDB
const FIELD_MAP: Record<string, string> = {
  'category': 'category',
  'branch': 'branch',
  'status': 'status',
  'assigned': 'assignedTo',
  'project': 'project',
  'repository': 'repository',
};

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fieldKey = searchParams.get('field');
  const query = searchParams.get('query') || '';

  const field = FIELD_MAP[fieldKey || ''];
  if (!field) {
    return NextResponse.json({ suggestions: [] });
  }

  await connectToDatabase();

  // 🔥 CORREÇÃO: Tipagem explícita do pipeline
  const pipeline: PipelineStage[] = [
    { $match: { tenantId: session.user.tenantId } },
    { $group: { _id: `$${field}` } },
    { 
      $match: { 
        _id: { 
          $ne: null,
          $regex: query, 
          $options: 'i' 
        }
      }
    },
    { $project: { value: '$_id' } },
    { $sort: { value: 1 } },
    { $limit: 15 }
  ];

  const results = await Observation.aggregate(pipeline);
  const suggestions = results.map((r: any) => r.value).filter(Boolean);
  
  return NextResponse.json({ suggestions });
}