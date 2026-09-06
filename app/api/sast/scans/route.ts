import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { SASTScan } from '@/models/SASTScan';
import { getServerAuthSession } from '@/lib/auth-server';
import type { SortOrder } from 'mongoose';

export async function GET(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const sortField = searchParams.get('sort') || 'scanDate';
    const sortOrder = searchParams.get('order') || 'desc';
    const search = searchParams.get('search') || '';

    const filter: any = {};
    if (search) {
      filter.$or = [
        { status: { $regex: search, $options: 'i' } },
        { _id: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const sort: [string, SortOrder][] = [[sortField, sortOrder === 'asc' ? 1 : -1]];

    const [items, total] = await Promise.all([
      SASTScan.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select('_id scanDate status totalOccurrences patternCount failedPatterns')
        .lean(),
      SASTScan.countDocuments(filter),
    ]);

    return NextResponse.json({
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Erro ao listar scans:', error.message);
    return NextResponse.json({ error: 'Falha ao listar scans' }, { status: 500 });
  }
}