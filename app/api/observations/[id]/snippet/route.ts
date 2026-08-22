// app/api/observations/[id]/snippet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Issue } from '@/models/Issue';
import { VulnerabilityPattern } from '@/models/VulnerabilityPattern';
import { Tenant } from '@/models/Tenant';
import { getServerAuthSession } from '@/lib/auth';
import https from 'node:https';
import { URL } from 'node:url';

async function azureFetch(urlString: string, pat: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const agent = new https.Agent({ rejectUnauthorized: false });
    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}` },
      agent,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Erro Azure: ${res.statusCode} - ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// 🔥 Mapeia offsets para linhas
function mapOffsetsToLines(offsets: number[], lines: string[]): Map<number, number> {
  const lineOffsets: number[] = [];
  let currentChar = 0;
  for (let i = 0; i < lines.length; i++) {
    lineOffsets[i] = currentChar;
    currentChar += lines[i].length + 1;
  }

  const offsetToLineMap = new Map<number, number>();
  offsets.forEach(offset => {
    let low = 0, high = lineOffsets.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (lineOffsets[mid] <= offset && (mid === lineOffsets.length - 1 || offset < lineOffsets[mid + 1])) {
        offsetToLineMap.set(offset, mid);
        break;
      }
      if (lineOffsets[mid] > offset) high = mid - 1;
      else low = mid + 1;
    }
  });
  return offsetToLineMap;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  // 🔥 Popula o padrão para trazer os dados mais atualizados
  const issue = await Issue.findById(params.id).populate('patternId'); 
  if (!issue || issue.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }

  const tenant = await Tenant.findById(issue.tenantId);
  if (!tenant || !tenant.azureSettings?.instanceUrl || !tenant.azureSettings?.pat) {
    return NextResponse.json({ error: 'Azure settings missing' }, { status: 400 });
  }

  const { instanceUrl, azureCollection, pat } = tenant.azureSettings;
  const { project, repository, filePath, branch, hits, patternId } = issue;

  const baseUrl = instanceUrl.replace(/\/+$/, '');
  const cleanCollection = azureCollection.replace(/^\/+|\/+$/g, '');
  const url = `${baseUrl}/tfs/${cleanCollection}/${project}/_apis/git/repositories/${repository}/items?path=${encodeURIComponent(filePath)}&versionDescriptor.versionType=branch&versionDescriptor.version=${encodeURIComponent(branch)}&includeContent=true&api-version=7.1`;

  try {
    const fileContent = await azureFetch(url, pat);
    const lines = fileContent.split('\n');
    const margin = 5;

    const offsets = hits?.map((h: any) => h.charOffset) || [];
    const offsetMap = mapOffsetsToLines(offsets, lines);

    // 🔥 CORREÇÃO DO ERRO DE BUILD: tipagem `: number` no offset
    const snippets = offsets.map((offset: number) => {
      const hitLine = offsetMap.get(offset) ?? 0;
      const start = Math.max(0, hitLine - margin);
      const end = Math.min(lines.length, hitLine + margin + 1);
      return {
        snippet: lines.slice(start, end).join('\n'),
        startLine: start + 1,
        hitLine: hitLine + 1
      };
    });

    if (snippets.length === 0 && issue.lineNumber) {
      const hitLine = issue.lineNumber - 1;
      const start = Math.max(0, hitLine - margin);
      const end = Math.min(lines.length, hitLine + margin + 1);
      snippets.push({
        snippet: lines.slice(start, end).join('\n'),
        startLine: start + 1,
        hitLine: hitLine + 1
      });
    }

    return NextResponse.json({
      snippets,
      pattern: patternId || null 
    });
    
  } catch (error: any) {
    console.error('Erro ao buscar snippet do Azure:', error.message);
    return NextResponse.json({
      snippets: [],
      pattern: patternId || null
    });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();
    const { assigneeId } = body; // Recebe o ID do usuário selecionado (ou null para limpar)

    await connectToDatabase();

    // Garante que a observação pertence ao tenant do usuário logado
    const updatedObservation = await Issue.findOneAndUpdate(
      { _id: id, tenantId: session.user.tenantId },
      { $set: { assigneeId: assigneeId || null } },
      { new: true }
    );

    if (!updatedObservation) {
      return NextResponse.json({ error: 'Observation not found' }, { status: 404 });
    }

    return NextResponse.json(updatedObservation);
  } catch (error) {
    console.error('Erro ao atualizar assignee da observation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}