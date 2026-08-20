// lib/azureSearch.ts
import https from 'node:https';
import { URL } from 'node:url';
import { Settings, SearchItem } from './types';
import { connectToDatabase } from './mongodb';
import { Team } from '@/models/Team';
import { Project } from '@/models/Project';
import { Repository } from '@/models/Repository';

export async function azureFetch(urlString: string, options: any, ignoreTls: boolean): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const agent = new https.Agent({ rejectUnauthorized: !ignoreTls });
    const req = https.request({
      hostname: url.hostname, port: url.port || 443,
      path: url.pathname + url.search,
      method: options.method || 'GET', headers: options.headers, agent: agent,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Falha ao fazer parse do JSON.')); }
        } else {
          reject(new Error(`Azure API error: ${res.statusCode} - ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Função de sincronização (mantida)
async function syncProjectsFromAzureResults(tenantId: string, results: SearchItem[]) {
  if (!results || results.length === 0) return;
  await connectToDatabase();

  let globalTeam = await Team.findOne({ tenantId, isGlobal: true });
  if (!globalTeam) {
    globalTeam = new Team({ tenantId, name: 'Global', isGlobal: true, members: [], projects: [] });
    await globalTeam.save();
  }

  for (const item of results) {
    let project = await Project.findOne({ tenantId, name: item.project });
    if (!project) {
      project = new Project({ tenantId, name: item.project, teamIds: [] });
      await project.save();
    }

    let repository = await Repository.findOne({ tenantId, name: item.repository });
    if (!repository) {
      repository = new Repository({ tenantId, name: item.repository, projectId: project._id.toString() });
      await repository.save();
    } else {
      if (repository.projectId !== project._id.toString()) {
        repository.projectId = project._id.toString();
        await repository.save();
      }
    }
  }

  // for (const projName of projectNames) {
  //   let project = await Project.findOne({ tenantId, name: projName });
  //   if (!project) {
  //     project = new Project({ tenantId, name: projName, teamIds: [] });
  //     await project.save();
  //   }

  //   let team = await Team.findOne({ tenantId, name: projName, isGlobal: false });
  //   if (!team) {
  //     team = new Team({
  //       tenantId,
  //       name: projName,
  //       members: [],
  //       projects: [project._id.toString()],
  //       isGlobal: false,
  //     });
  //     await team.save();
  //     if (!project.teamIds.includes(team._id.toString())) {
  //       project.teamIds.push(team._id.toString());
  //       await project.save();
  //     }
  //   } else {
  //     if (!team.projects.includes(project._id.toString())) {
  //       team.projects.push(project._id.toString());
  //       await team.save();
  //     }
  //   }

  //   if (!globalTeam.projects.includes(project._id.toString())) {
  //     globalTeam.projects.push(project._id.toString());
  //     await globalTeam.save();
  //   }
  // }
}

export async function executeSearch(
  query: string,
  settings: Settings,
  ignoreTls: boolean,
  tenantId?: string
): Promise<{ results: SearchItem[]; hitCount: number; error?: string }> {
  
  // 🔥 VALIDAÇÃO EXPLÍCITA PARA EVITAR ZEROS SILENCIOSOS
  const { instanceUrl, azureCollection, pat, username } = settings;
  
  if (!instanceUrl) return { results: [], hitCount: 0, error: 'URL da instância não configurada.' };
  if (!azureCollection) return { results: [], hitCount: 0, error: 'Coleção (azureCollection) não configurada.' };
  if (!pat) return { results: [], hitCount: 0, error: 'Token (PAT) não configurado.' };

  const baseUrl = instanceUrl.replace(/\/+$/, '');
  const cleanCollection = azureCollection.replace(/^\/+|\/+$/g, '');
  const authUser = username || '';
  const authString = Buffer.from(`${authUser}:${pat}`).toString('base64');

  const advancedUrl = `${baseUrl}/tfs/${cleanCollection}/_apis/search/codeAdvancedQueryResults?api-version=7.1-preview`;
  const basicUrl = `${baseUrl}/tfs/${cleanCollection}/_apis/search/codeQueryResults?api-version=7.1-preview`;
  const headers = { Authorization: `Basic ${authString}`, 'Content-Type': 'application/json' };

  async function fetchAzure(url: string, payload: any): Promise<any> {
    return azureFetch(url, { method: 'POST', headers, body: JSON.stringify(payload) }, ignoreTls);
  }

  const basePayload = {
    searchText: query, skipResults: 0, takeResults: 1,
    filters: [], searchFilters: {}, sortOptions: [],
    summarizedHitCountsNeeded: true,
    includeSuggestions: false, isInstantSearch: false,
  };

  let finalUrl = advancedUrl; let initialData;
  try {
    initialData = await fetchAzure(advancedUrl, basePayload);
  } catch (error: any) {
    // Tenta fallback para a API básica se a avançada falhar
    if (error.message.includes('400') && error.message.includes('InvalidQueryException')) {
      finalUrl = basicUrl;
      try {
        initialData = await fetchAzure(basicUrl, basePayload);
      } catch (fallbackError: any) {
        return { results: [], hitCount: 0, error: `Erro na API Básica: ${fallbackError.message}` };
      }
    } else {
      return { results: [], hitCount: 0, error: `Erro na API Avançada: ${error.message}` };
    }
  }

  const totalCount = initialData.results?.count || 0;
  if (totalCount === 0) return { results: [], hitCount: 0  };

  const MAX_ALLOWED = 1000; const maxToFetch = Math.min(totalCount, MAX_ALLOWED); const BATCH_SIZE = 100;
  let allValues: SearchItem[] = []; let currentSkip = 0;

  while (currentSkip < maxToFetch) {
    const remaining = maxToFetch - currentSkip; const currentTop = Math.min(remaining, BATCH_SIZE);
    const batchPayload = { ...basePayload, skipResults: currentSkip, takeResults: currentTop, summarizedHitCountsNeeded: false };
    const batchData = await fetchAzure(finalUrl, batchPayload);
    if (batchData.results?.values) {
      allValues = allValues.concat(batchData.results.values);
    }
    currentSkip += currentTop;
  }

  if (tenantId && allValues.length > 0) {
    await syncProjectsFromAzureResults(tenantId, allValues);
  }

  return { results: allValues, hitCount: totalCount };
}