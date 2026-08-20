// app/api/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Issue } from '@/models/Issue';
import { SearchRecord } from '@/models/SearchRecord'; // <-- Importado
import { SASTScan } from '@/models/SASTScan';         // <-- Importado
import { getServerAuthSession } from '@/lib/auth';
import { subDays, format } from 'date-fns';            // <-- Adicionado format
import { PipelineStage } from 'mongoose';
import { parseSearchQuery } from '@/lib/searchParser';

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);

  const range = searchParams.get('range') || '7d';
  const projectId = searchParams.get('projectId');
  const searchQuery = searchParams.get('search') || '';

  let matchStage: any = { tenantId };

  if (range === '7d') matchStage.firstSeen = { $gte: subDays(new Date(), 7) };
  else if (range === '14d') matchStage.firstSeen = { $gte: subDays(new Date(), 14) };
  else if (range === '30d') matchStage.firstSeen = { $gte: subDays(new Date(), 30) };

  if (projectId && projectId !== 'all') {
    matchStage.project = projectId;
  }

  if (searchQuery) {
    matchStage = parseSearchQuery(searchQuery, matchStage);
  }

  // ================= KPIs e Gráficos de Issue (Não mexa, estão excelentes) =================
  // 1. KPIs Gerais
  const kpiPipeline: PipelineStage[] = [
    { $match: matchStage },
    { $group: { 
      _id: null,
      total: { $sum: 1 },
      open: { $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } },
      recurring: { $sum: { $cond: [{ $eq: ["$status", "recurring"] }, 1, 0] } },
      fixed: { $sum: { $cond: [{ $eq: ["$status", "fixed"] }, 1, 0] } },
      wontFix: { $sum: { $cond: [{ $eq: ["$status", "wont_fix"] }, 1, 0] } },
    }}
  ];

  const kpiResult = await Issue.aggregate(kpiPipeline);
  const kpi = kpiResult[0] || { total: 0, open: 0, recurring: 0, fixed: 0, wontFix: 0 };

  // 2. Severidade
  const severityPipeline: PipelineStage[] = [
    { $match: matchStage },
    { $group: { _id: "$severity", count: { $sum: 1 } } }
  ];
  const severityData = await Issue.aggregate(severityPipeline);
  const severityTotals: Record<string, number> = {};
  severityData.forEach((d: any) => {
    severityTotals[d._id || 'unknown'] = d.count;
  });

  // 3. Categoria
  const categoryPipeline: PipelineStage[] = [
    { $match: matchStage },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ];
  const categoryData = await Issue.aggregate(categoryPipeline);
  const categoryTotals = categoryData.map((d: any) => ({
    label: d._id || 'Sem Categoria',
    value: d.count
  }));

  // 4. Projeto (TOP 10)
  const projectPipeline: PipelineStage[] = [
    { $match: matchStage },
    { $group: { _id: "$project", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ];
  const projectData = await Issue.aggregate(projectPipeline);
  const projectTotals = projectData.map((d: any) => ({
    label: d._id || 'Sem Projeto',
    value: d.count
  }));

  // ================= GRÁFICO DE LINHA (Substituído pela lógica do Dashboard) =================
  // 🔥 Replicando a lógica do buildDateFilter do Dashboard
  const buildDateFilter = (field: string) => {
    let filter: any = { tenantId };
    if (range === '24h') { filter[field] = { $gte: subDays(new Date(), 1) }; }
    else if (range === '7d') { filter[field] = { $gte: subDays(new Date(), 7) }; }
    else if (range === '14d') { filter[field] = { $gte: subDays(new Date(), 14) }; }
    else if (range === '30d') { filter[field] = { $gte: subDays(new Date(), 30) }; }
    return filter;
  };

  // Buscar SearchRecords e SASTScans no período
  const searchFilter = buildDateFilter('createdAt');
  const searchRecords = await SearchRecord.find(searchFilter).lean();

  const sastFilter = buildDateFilter('scanDate');
  const sastScans = await SASTScan.find(sastFilter).lean();

  // Consolidar dados por dia
  const dailyData: Record<string, number> = {};
  for (const record of searchRecords) {
    const day = format(new Date(record.createdAt), 'yyyy-MM-dd');
    dailyData[day] = (dailyData[day] || 0) + (record.totalHits || 0);
  }
  for (const scan of sastScans) {
    const day = format(new Date(scan.scanDate), 'yyyy-MM-dd');
    dailyData[day] = (dailyData[day] || 0) + (scan.totalOccurrences || 0);
  }

  // Converter para o formato esperado pelo front-end
  const chartData = Object.entries(dailyData).map(([label, value]) => ({ label, value }));

  // ================= Retorno Final =================
  return NextResponse.json({
    kpi: {
      total: kpi.total,
      open: kpi.open,
      recurring: kpi.recurring,
      fixed: kpi.fixed,
      wontFix: kpi.wontFix,
      accepted: kpi.open + kpi.recurring,
    },
    severityTotals,
    categoryTotals,
    projectTotals,
    chartData, // <-- Agora alimentado pela lógica do Dashboard
  });
}