// app/api/sast/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getServerAuthSession } from '@/lib/auth';
import { User } from '@/models/User';
import { Tenant } from '@/models/Tenant';
import { VulnerabilityPattern } from '@/models/VulnerabilityPattern';
import { SASTScan } from '@/models/SASTScan';
import { Issue } from '@/models/Issue';
import { executeSearch } from '@/lib/azureSearch';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const dbUser = await User.findOne({ sub: session.user.id });

    let tenant = null;
    const tenantIdCandidate = dbUser?.tenantId;
    if (tenantIdCandidate) {
      tenant = await Tenant.findOne({ uuid: tenantIdCandidate });
    }
    if (!tenant && tenantIdCandidate && mongoose.Types.ObjectId.isValid(tenantIdCandidate)) {
      tenant = await Tenant.findById(tenantIdCandidate);
    }

    if (!tenant || !tenant.azureSettings) {
      return NextResponse.json({ error: 'Azure settings not configured.' }, { status: 400 });
    }

    const settings = tenant.azureSettings;
    const ignoreTls = settings.ignoreTlsErrors || false;
    const tenantId = tenant._id.toString();

    const patterns = await VulnerabilityPattern.find({ enabled: true }).lean();
    if (!patterns.length) {
      return NextResponse.json({ error: 'Nenhum pattern SAST ativo.' }, { status: 400 });
    }

    const existingIssues = await Issue.find({
      tenantId,
      status: { $in: ['open', 'recurring'] }
    }).lean();

    const issueMap = new Map<string, any>();
    existingIssues.forEach(issue => {
      const key = `${issue.patternId}|${issue.filePath}`;
      issueMap.set(key, issue);
    });

    const patternResults = [];
    let totalOccurrences = 0;
    let failedPatterns = 0;
    const newIssues: any[] = [];
    const updates: any[] = [];

    const newScan = new SASTScan({
      tenantId,
      scanDate: new Date(),
      patterns: [],
      totalOccurrences: 0,
      summary: [],
    });
    await newScan.save();

    for (const pattern of patterns) {
      try {
        const result = await executeSearch(pattern.queryPattern, settings, ignoreTls, tenantId);

        if (result.error) {
          patternResults.push({
            patternId: pattern._id.toString(),
            query: pattern.queryPattern,
            category: pattern.category,
            severity: pattern.severity,
            slaHours: pattern.slaHours,
            results: [],
            hitCount: 0,
            error: result.error,
          });
          failedPatterns++;
          continue;
        }

        patternResults.push({
          patternId: pattern._id.toString(),
          query: pattern.queryPattern,
          category: pattern.category,
          severity: pattern.severity,
          slaHours: pattern.slaHours,
          results: result.results,
          hitCount: result.hitCount,
        });
        totalOccurrences += result.hitCount;

        for (const item of result.results) {
          const key = `${pattern._id.toString()}|${item.path}`;
          const existingIssue = issueMap.get(key);

          if (existingIssue) {
            updates.push({
              updateOne: {
                filter: { _id: existingIssue._id },
                update: {
                  $set: {
                    status: 'recurring',
                    lastSeen: new Date(),
                    hitCount: item.hitCount || 0,
                    scanId: newScan._id,
                    project: item.project || '',
                    repository: item.repository || '',
                  }
                }
              }
            });
          } else {
            const now = new Date();
            const slaDueAt = new Date(now.getTime() + (pattern.slaHours || 72) * 3600 * 1000);

            let snippet = '';
            let lineNumber = 0;
            if (item.hits && Array.isArray(item.hits) && item.hits.length > 0) {
              const firstHit = item.hits[0];
              snippet = firstHit.content || firstHit.line || '';
              lineNumber = firstHit.lineNumber || firstHit.line || 0;
            }

            // 🔥 GRAVAÇÃO CORRETA DA SEVERIDADE E SLA
            newIssues.push({
              tenantId,
              scanId: newScan._id,
              patternId: pattern._id.toString(),
              query: pattern.queryPattern,
              category: pattern.category,
              severity: pattern.severity,
              slaHours: pattern.slaHours,
              fileName: item.fileName,
              filePath: item.path,
              project: item.project || '',
              repository: item.repository || '',
              branch: item.branch || 'main',
              hitCount: item.hitCount || 0,
              status: 'open',
              firstSeen: now,
              lastSeen: now,
              slaDueAt: slaDueAt,
              snippet: snippet,
              lineNumber: lineNumber,
            });
          }
        }
      } catch (searchErr: any) {
        console.error(`Erro crítico ao buscar padrão ${pattern.name}:`, searchErr.message);
        patternResults.push({
          patternId: pattern._id.toString(),
          query: pattern.queryPattern,
          category: pattern.category,
          severity: pattern.severity,
          slaHours: pattern.slaHours,
          results: [],
          hitCount: 0,
          error: searchErr.message,
        });
        failedPatterns++;
      }
    }

    if (newIssues.length > 0) {
      await Issue.insertMany(newIssues);
    }
    if (updates.length > 0) {
      await Issue.bulkWrite(updates);
    }

    newScan.patterns = patternResults;
    newScan.totalOccurrences = totalOccurrences;
    newScan.summary = [];
    await newScan.save();

    return NextResponse.json({
      success: true,
      scanId: newScan._id,
      totalOccurrences,
      patternsExecuted: patterns.length,
      failedPatterns: failedPatterns,
      patterns: patternResults,
    });

  } catch (error: any) {
    console.error('Erro fatal no SAST:', error.message);
    return NextResponse.json(
      { error: `Falha interna no servidor durante o SAST: ${error.message}` },
      { status: 500 }
    );
  }
}