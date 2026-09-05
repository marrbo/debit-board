// app/api/sast/run/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/models/User';
import { Tenant } from '@/models/Tenant';
import { VulnerabilityPattern } from '@/models/VulnerabilityPattern';
import { SASTScan } from '@/models/SASTScan';
import { Observation } from '@/models/Observation';
import { executeSearch } from '@/lib/azureSearch';
import mongoose from 'mongoose';
import type { SearchItem } from '@/lib/types';
import { getServerAuthSession } from '@/lib/auth-server';

// Padrões de exclusão (caminhos/arquivos que devem ser ignorados)
const EXCLUDED_DIRS = [
  'node_modules', 'bin', 'obj', 'dist', 'build', '.git', '__pycache__',
  'venv', 'vendor', '.next', '.nuxt', 'coverage', '.gradle', '.idea',
  '.vscode', 'target', 'tmp', 'temp', 'logs', 'log', 'packages', 'files',
  'uploads'
];

const EXCLUDED_FILE_EXTENSIONS = [
  '.min.js', '.min.css', '.map', '.lock', '.bundle.js', '.bundle.min.js'
];

function isExcludedPath(filePath: string): boolean {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  
  const parts = normalized.split('/');
  if (parts.some(part => EXCLUDED_DIRS.includes(part))) return true;
  
  const lowerPath = normalized.toLowerCase();
  if (EXCLUDED_FILE_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) return true;
  
  return false;
}

export async function POST() {
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

    const existingObservations = await Observation.find({ tenantId }).lean();
    const observationMap = new Map<string, any>();
    existingObservations.forEach(observation => {
      const key = `${observation.project || ''}|${observation.repository || ''}|${observation.filePath}|${observation.category}`;
      observationMap.set(key, observation);
    });

    const foundKeys = new Set<string>();
    const patternResults = [];
    let totalOccurrences = 0;
    let failedPatterns = 0;
    const newObservations: any[] = [];
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
            values: [],
            hits: [],
            hitCount: 0,
            error: result.error,
          });
          failedPatterns++;
          continue;
        }

        // 🔥 Aplicar exclusões antes de qualquer processamento
        result.results = result.results.filter(
          (item: SearchItem) => ['main', 'master'].includes(item.branch) && !isExcludedPath(item.path)
        );

        patternResults.push({
          patternId: pattern._id.toString(),
          query: pattern.queryPattern,
          category: pattern.category,
          severity: pattern.severity,
          slaHours: pattern.slaHours,
          results: result.results,
          hitCount: result.results.length,
        });
        
        totalOccurrences += result.results.length;

        for (const item of result.results) {
          const key = `${item.project || ''}|${item.repository || ''}|${item.path}|${pattern.category}`;
          
          if (foundKeys.has(key)) continue;
          foundKeys.add(key);

          const existingIssue = observationMap.get(key);

          if (existingIssue) {
            let nextStatus = existingIssue.status;
            if (existingIssue.status === 'resolved') {
              nextStatus = 'recurring';
            }

            updates.push({
              updateOne: {
                filter: { _id: existingIssue._id },
                update: {
                  $set: {
                    status: nextStatus,
                    lastSeen: new Date(),
                    hitCount: item.hitCount || 0,
                    patternId: pattern._id.toString(),
                    hits: item.hits,
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

            newObservations.push({
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
              hits: item.hits,
              status: 'open',
              firstSeen: now,
              lastSeen: now,
              slaDueAt: slaDueAt,
              snippet: null,
              lineNumber: 0,
            });
            
            observationMap.set(key, { _id: 'temp', status: 'open' });
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

    // 🚀 Marca como resolved/exclusion as observations que existiam anteriormente mas sumiram no scan atual
    const resolvedUpdates: any[] = [];
    observationMap.forEach((issue, key) => {
      if (!foundKeys.has(key) && issue._id !== 'temp') {
        let nextStatus = 'resolved';
        // Se o arquivo estiver em caminho excluído, marca como 'exclusion'
        if (isExcludedPath(issue.filePath) && issue.status !== 'exclusion') {
          nextStatus = 'exclusion';
        } else if (issue.status !== 'resolved') {
          nextStatus = 'resolved';
        }

        if (issue.status !== nextStatus) {
          resolvedUpdates.push({
            updateOne: {
              filter: { _id: issue._id },
              update: {
                $set: {
                  status: nextStatus,
                  lastSeen: new Date(),
                }
              }
            }
          });
        }
      }
    });

    if (newObservations.length > 0) {
      await Observation.insertMany(newObservations);
    }
    if (updates.length > 0) {
      await Observation.bulkWrite(updates);
    }
    if (resolvedUpdates.length > 0) {
      await Observation.bulkWrite(resolvedUpdates);
    }

    newScan.patterns = (patternResults as any);
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