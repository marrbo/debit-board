// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { SearchRecord } from '@/models/SearchRecord';
import { SASTScan } from '@/models/SASTScan';
import { Observation } from '@/models/Issue';
import { getServerAuthSession } from '@/lib/auth';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const buildDateFilter = (field: string) => {
    let filter: any = { tenantId };
    if (period === '24h') { filter[field] = { $gte: subDays(new Date(), 1) }; }
    else if (period === '7d') { filter[field] = { $gte: subDays(new Date(), 7) }; }
    else if (period === '30d') { filter[field] = { $gte: subDays(new Date(), 30) }; }
    else if (period === 'custom' && start && end) {
      filter[field] = { $gte: startOfDay(new Date(start)), $lte: endOfDay(new Date(end)) };
    }
    return filter;
  };

  // Buscar SearchRecords e SASTScans (para o gráfico de evolução)
  const searchFilter = buildDateFilter('createdAt');
  const searchRecords = await SearchRecord.find(searchFilter).lean();

  const sastFilter = buildDateFilter('scanDate');
  const sastScans = await SASTScan.find(sastFilter).lean();

  // Consolidar dados de evolução por dia
  const dailyData: Record<string, number> = {};
  for (const record of searchRecords) {
    const day = format(new Date(record.createdAt), 'yyyy-MM-dd');
    dailyData[day] = (dailyData[day] || 0) + (record.totalHits || 0);
  }
  for (const scan of sastScans) {
    const day = format(new Date(scan.scanDate), 'yyyy-MM-dd');
    dailyData[day] = (dailyData[day] || 0) + (scan.totalOccurrences || 0);
  }

  // KPIs de Observations (Abertas, Recorrentes, Resolvidas, Não Corrigir)
  const observationsStats = await Observation.aggregate([
    { $match: { tenantId: tenantId } },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);

  const statsMap = observationsStats.reduce((acc: Record<string, number>, curr: any) => {
    acc[curr._id] = curr.count;
    return acc;
  }, {} as Record<string, number>);

  const overdueCount = await Observation.countDocuments({
    tenantId: tenantId,
    status: { $in: ['open', 'recurring'] },
    slaDueAt: { $lt: new Date() }
  });

  if (overdueCount > 0) {
    await Observation.updateMany({
      tenantId: tenantId,
      status: { $in: ['open', 'recurring'] },
      slaDueAt: { $lt: new Date() }
    }, { $set: { status: 'open' } });
  }

  return NextResponse.json({
    dailyData,
    totalRecords: searchRecords.length + sastScans.length,
    totalHits: searchRecords.reduce((sum, r) => sum + (r.totalHits || 0), 0) +
               sastScans.reduce((sum, s) => sum + (s.totalOccurrences || 0), 0),
    uniqueGerencia: new Set(searchRecords.map(r => r.gerencia).filter(Boolean)).size,
    observationsStats: {
      open: statsMap['open'] || 0,
      recurring: statsMap['recurring'] || 0,
      overdue: overdueCount,
      resolved: statsMap['resolved'] || 0,
      wont_fix: statsMap['wont_fix'] || 0,
    }
  });
}