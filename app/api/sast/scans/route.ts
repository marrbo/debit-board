// app/api/sast/scans/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { SASTScan } from '@/models/SASTScan';
import { handleGenericGet } from '@/lib/api-handler';
import { getServerAuthSession } from '@/lib/auth-server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const isAll = searchParams.get('all') === 'true';
  const searchQueryRaw =
    searchParams.get('search') || searchParams.get('q') || '';

  return handleGenericGet(req, {
    model: SASTScan,
    defaultSort: 'scanDate',
    overrideSearchQuery: searchQueryRaw,
    all: isAll,
    projection: {
      _id: 1,
      scanDate: 1,
      status: 1,
      totalOccurrences: 1,
      patternCount: 1,
      failedPatterns: 1,
    },
  });
}