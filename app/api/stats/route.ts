// app/api/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Issue } from '@/models/Issue';
import { SearchRecord } from '@/models/SearchRecord';
import { SASTScan } from '@/models/SASTScan';
import { getServerAuthSession } from '@/lib/auth';
import { subDays, format } from 'date-fns';
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

  // ================= KPIs e Gráficos de Issue =================
  // 1. KPIs Gerais
  const kpiPipeline: PipelineStage[] = [
    { $match: matchStage },
    { $group: { 
      _id: null,
      total: { $sum: 1 },
      open: { $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } },
      recurring: { $sum: { $cond: [{ $eq: ["$status", "recurring"] }, 1, 0] } },
      resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
      wontFix: { $sum: { $cond: [{ $eq: ["$status", "wont_fix"] }, 1, 0] } },
      expiredSLA: { $sum: { $cond: [{ $lt: ["$slaDueAt", new Date()] }, 1, 0] } }
    }}
  ];

  const kpiResult = await Issue.aggregate(kpiPipeline);
  const kpi = kpiResult[0] || { total: 0, open: 0, recurring: 0, resolved: 0, wontFix: 0 };

  // 2. Severidade geral
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

  // 4. Projeto (TOP 10) + status/severidade
  const projectPipeline: PipelineStage[] = [
    { $match: matchStage },
    { $group: { _id: "$project", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ];
  const projectData = await Issue.aggregate(projectPipeline);

  const projectStatusPipeline: PipelineStage[] = [
    { $match: matchStage },
    { $group: { _id: { project: "$project", status: "$status" }, count: { $sum: 1 } } },
    { $sort: { "_id.project": 1, "_id.status": 1 } }
  ];
  const projectStatusData = await Issue.aggregate(projectStatusPipeline);

  const projectSeverityPipeline: PipelineStage[] = [
    { $match: matchStage },
    { $group: { _id: { project: "$project", severity: "$severity" }, count: { $sum: 1 } } },
    { $sort: { "_id.project": 1, "_id.severity": 1 } }
  ];
  const projectSeverityData = await Issue.aggregate(projectSeverityPipeline);

  const projectStatusTotals = projectStatusData.reduce((acc: any, item: any) => {
    const proj = item._id.project || 'Sem Projeto';
    const status = item._id.status || 'unknown';
    if (!acc[proj]) acc[proj] = {};
    acc[proj][status] = item.count;
    return acc;
  }, {});

  const projectSeverityTotals = projectSeverityData.reduce((acc: any, item: any) => {
    const proj = item._id.project || 'Sem Projeto';
    const sev = item._id.severity || 'unknown';
    if (!acc[proj]) acc[proj] = {};
    acc[proj][sev] = item.count;
    return acc;
  }, {});

  const projectTotalsArray = projectData.map((d: any) => ({
    label: d._id || 'Sem Projeto',
    value: d.count,
    status: projectStatusTotals[d._id || 'Sem Projeto'] || {},
    severity: projectSeverityTotals[d._id || 'Sem Projeto'] || {}
  }));

  // ================= GRÁFICO DE LINHA (Evolução por Severidade e Status) =================
  // 🔥 Duas agregações: uma por severidade e outra por status
  const dateFilter = { $gte: subDays(new Date(), range === '24h' ? 1 : range === '7d' ? 7 : range === '14d' ? 14 : 30) };

  // Agregação por severidade
  const evolutionSeverityPipeline: PipelineStage[] = [
    { $match: { ...matchStage, firstSeen: dateFilter } },
    { $group: {
        _id: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$firstSeen" } },
          severity: "$severity"
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.day": 1 } }
  ];
  const evolutionSeverityData = await Issue.aggregate(evolutionSeverityPipeline);

  // Agregação por status
  const evolutionStatusPipeline: PipelineStage[] = [
    { $match: { ...matchStage, firstSeen: dateFilter } },
    { $group: {
        _id: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$firstSeen" } },
          status: "$status"
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.day": 1 } }
  ];
  const evolutionStatusData = await Issue.aggregate(evolutionStatusPipeline);

  // Consolidar por dia
  const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '14d' ? 14 : 30;
  const today = new Date();
  const chartData: any = [];

  // Preencher todos os dias do período
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(today, i);
    const key = format(date, 'yyyy-MM-dd');
    chartData.push({
      label: key,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0,
      open: 0,
      recurring: 0,
      resolved: 0,
      wontFix: 0,
      expiredSLA: 0
    });
  }

  // Mapear dias para índices
  const dayMap = new Map<string, number>();
  chartData.forEach((item: any, index: number) => dayMap.set(item.label, index));

  // Preencher severidade
  evolutionSeverityData.forEach((item: any) => {
    const day = item._id.day;
    const idx = dayMap.get(day);
    if (idx !== undefined) {
      const sev = item._id.severity || 'unknown';
      chartData[idx][sev] = (chartData[idx][sev] || 0) + item.count;
      chartData[idx].total += item.count;
    }
  });

  // Preencher status
  evolutionStatusData.forEach((item: any) => {
    const day = item._id.day;
    const idx = dayMap.get(day);
    if (idx !== undefined) {
      const status = item._id.status || 'unknown';
      if (status === 'wont_fix') {
        chartData[idx].wontFix += item.count;
      } else if (status === 'resolved') {
        chartData[idx].resolved += item.count;
      } else if (status === 'open') {
        chartData[idx].open += item.count;
      } else if (status === 'recurring') {
        chartData[idx].recurring += item.count;
      } else if (status === 'recurring') {
        chartData[idx].expiredSLA += item.count;
      }
      // Outros status podem ser ignorados ou adicionados dinamicamente
    }
  });

  // ================= Retorno Final =================
  return NextResponse.json({
    kpi: {
      total: kpi.total,
      open: kpi.open,
      recurring: kpi.recurring,
      resolved: kpi.resolved,
      wontFix: kpi.wontFix,
      accepted: kpi.open + kpi.recurring,
      expiredSLA: kpi.expiredSLA
    },
    severityTotals,
    categoryTotals,
    projectTotals: projectTotalsArray,
    chartData,
  });
}