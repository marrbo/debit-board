// app/api/azure/sync/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Tenant } from '@/models/Tenant';
import { Project } from '@/models/Project';
import { Repository } from '@/models/Repository';
import * as azdev from 'azure-devops-node-api';
import { getPersonalAccessTokenHandler } from 'azure-devops-node-api';
import { getServerSessionIds } from '@/lib/session-server';
import { BuildStatus, BuildResult } from "azure-devops-node-api/interfaces/BuildInterfaces";

export async function POST(_: NextRequest) {
  const sessionIds = await getServerSessionIds();
  const tenantId = sessionIds.tenantId;

  await connectToDatabase();

  const tenant = await Tenant.findOne({ _id: { $eq: tenantId } }).lean();
  if (!tenant || !tenant.azureSettings || !tenant.azureSettings.instanceUrl || !tenant.azureSettings.pat) {
    return NextResponse.json(
      { error: 'Configurações do Azure DevOps não encontradas para este Tenant.' },
      { status: 400 }
    );
  }

  const { instanceUrl, pat, azureCollection = 'DefaultCollection' } = tenant.azureSettings;

  try {
    const urlWithCollection = `${instanceUrl}/tfs/${azureCollection}/`;
    const authHandler = getPersonalAccessTokenHandler(pat, true);
    const connection = new azdev.WebApi(urlWithCollection, authHandler, { ignoreSslError: tenant.azureSettings.ignoreTlsErrors });

    const gitApi = await connection.getGitApi();
    const coreApi = await connection.getCoreApi();
    const buildApi = await connection.getBuildApi();

    const projects = await coreApi.getProjects();
    if (!projects || projects.length === 0) {
      return NextResponse.json({ message: 'Nenhum projeto encontrado no Azure.' });
    }

    let updatedProjects = 0;
    let updatedRepos = 0;

    // Conjunto de azureProjectIds retornados pelo Azure (para marcar inativos)
    const azureProjectIds = new Set<string>();

    for (const azureProject of projects) {
      const projectName = azureProject.name!;
      const azureProjectId = azureProject.id!;
      azureProjectIds.add(azureProjectId);

      // Buscar definições de pipelines (clássicas e YAML)
      const definitions = await buildApi.getDefinitions(projectName);
      const pipelineCount = definitions.length;
      const pipelineClassicCount = definitions.filter(def => def.type === 1 || def.type === 2).length; // 1=Build, 2=Release
      const pipelineYamlCount = definitions.filter(def => def.type !== 1 && def.type !== 2).length;
      // Contagem de falhas/sucessos: vamos buscar os builds recentes e contar
      let pipelineFailedCount = 0;
      let pipelineSuccessCount = 0;
      const recentBuilds = await buildApi.getBuilds(projectName, undefined, undefined, undefined, undefined, undefined, undefined, undefined, BuildStatus.All);
      if (recentBuilds && recentBuilds.length > 0) {
        pipelineFailedCount = recentBuilds.filter(b => b.result !== BuildResult.Canceled && b.result !== BuildResult.Succeeded).length; // 2=failed, 4=partiallySucceeded
        pipelineSuccessCount = recentBuilds.filter(b => b.result === 0 || b.result === BuildResult.Succeeded).length; // 0=succeeded, 1=partiallySucceeded? Na verdade 0=succeeded, 1=partiallySucceeded, 2=failed, 4=canceled. Vou usar 0 como succeeded.
      }

      // Obter repositórios do projeto
      const repos = await gitApi.getRepositories(azureProjectId);
      const repositoryCount = repos ? repos.length : 0;

      // URL do projeto no web
      let projectWebUrl = undefined;
      try {
        const projectDataUrls = await fetch(azureProject.url!);
        const projectUrlsArray = await projectDataUrls.json();
        projectWebUrl = projectUrlsArray._links?.web?.href;
      } catch {
        projectWebUrl = `${urlWithCollection}${projectName}`;
      }

      // 1. Upsert Project - sempre atualiza com os dados mais recentes
      const savedProject = await Project.findOneAndUpdate(
        { tenantId: { $eq: tenantId }, azureProjectId: { $eq: azureProjectId } },
        {
          name: projectName,
          azureProjectId,
          tenantId,
          azureProjectUrl: projectWebUrl,
          description: azureProject.description,
          defaultTeamImageUrl: azureProject.defaultTeamImageUrl,
          visibility: azureProject.visibility,
          lastUpdateTime: azureProject.lastUpdateTime ? new Date(azureProject.lastUpdateTime) : new Date(),
          syncDate: new Date(),
          pipelineCount,
          pipelineFailedCount,
          pipelineSuccessCount,
          pipelineClassicCount,
          pipelineYamlCount,
          repositoryCount,
          isActive: true, // sempre ativo
        },
        { upsert: true, new: true }
      );
      updatedProjects++;

      // 2. Upsert Repositories
      if (repos && repos.length > 0) {
        for (const azureRepo of repos) {
          await Repository.findOneAndUpdate(
            { tenantId: { $eq: tenantId }, azureRepoId: azureRepo.id! },
            {
              name: azureRepo.name!,
              projectId: savedProject._id.toString(),
              azureProjectId,
              azureRepoId: azureRepo.id!,
              url: azureRepo.url!,
              tenantId,
              syncDate: new Date(),
              isActive: true,
            },
            { upsert: true, new: true }
          );
          updatedRepos++;
        }
      }
    }

    // 3. Marcar projetos inativos (não retornados pelo Azure)
    await Project.updateMany(
      { tenantId: { $eq: tenantId }, azureProjectId: { $nin: Array.from(azureProjectIds) } },
      { $set: { isActive: false } }
    );

    // 4. Marcar repositórios inativos associados a projetos inativos
    // Buscar todos os projetos inativos deste tenant
    const inactiveProjects = await Project.find({ tenantId, isActive: false }).select('_id').lean();
    const inactiveProjectIds = inactiveProjects.map(p => p._id.toString());
    if (inactiveProjectIds.length > 0) {
      await Repository.updateMany(
        { tenantId, projectId: { $in: inactiveProjectIds } },
        { $set: { isActive: false } }
      );
    }

    return NextResponse.json({
      message: 'Sincronização concluída com sucesso!',
      details: {
        projectsUpdated: updatedProjects,
        repositoriesUpdated: updatedRepos,
      }
    });
  } catch (error: unknown) {
    console.error('Erro na sincronização com Azure DevOps:', error);
    const message = error instanceof Error ? error.message : 'Erro interno ao sincronizar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}