// app/api/patterns/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { VulnerabilityPattern } from '@/models/VulnerabilityPattern';
import { getServerAuthSession } from '@/lib/auth-server';

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  // Busca todos os padrões ativos (considerando que são globais para o sistema)
  const patterns = await VulnerabilityPattern.find({ enabled: true }).lean();

  // Extrai e deduplica as categorias
  const categories = [...new Set(patterns.map(p => p.category).filter(Boolean))];

  return NextResponse.json(categories);
}