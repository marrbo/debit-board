// app/api/azure/sync/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Tenant } from '@/models/Tenant';
import { Project } from '@/models/Project';
import { Repository } from '@/models/Repository';
import * as azdev from 'azure-devops-node-api';
import { getPersonalAccessTokenHandler } from 'azure-devops-node-api';

export async function POST(req: NextRequest) {
  const tenantId = req.headers.get('x-tenant-id');

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
    // let updatedPipelines = 0;

    for (const azureProject of projects) {
      const projectName = azureProject.name!;
      const azureProjectId = azureProject.id!;

      // 3. Buscar pipelines associadas a este repositório
      // 3.1 Obter todas as definições de build do projeto
      const projectDefinitions = await buildApi.getDefinitions(azureProject.name);

      let projectWebUrl = undefined;

      try {
        const projectDataUrls = await fetch(azureProject.url!);
        const projectUrlsArray = await projectDataUrls.json();
        projectWebUrl = projectUrlsArray._links?.web?.href;
      } catch {
        console.warn(`Não foi possível obter a URL do projeto ${projectName}.`);
        projectWebUrl = `${urlWithCollection}${azureProject.name}`;
      }

      // 1. Upsert Project
      const savedProject = await Project.findOneAndUpdate(
        { tenantId: { $eq: tenantId }, azureProjectId: { $eq: azureProjectId } },
        {
          name: projectName,
          azureProjectId,
          tenantId,
          azureProjectUrl: projectWebUrl!,
          description: azureProject.description,
          defaultTeamImageUrl: azureProject.defaultTeamImageUrl,
          visibility: azureProject.visibility,
          createdAt: new Date(),
          lastUpdateTime: azureProject.lastUpdateTime ? new Date(azureProject.lastUpdateTime) : new Date(),
          syncDate: new Date(),
          pipelineCount: projectDefinitions.length,
          pipelineFailedCount: projectDefinitions.filter(def => def.type === 1 || def.type === 2).length, // Exemplo de contagem de pipelines clássicas
          pipelineClassicCount: projectDefinitions.filter(def => def.type === 1 || def.type === 2).length,
          pipelineYamlCount: projectDefinitions.filter(def => def.type !== 1 && def.type !== 2).length,
        },
        { upsert: true, new: true }
      );
      updatedProjects++;

      // 2. Buscar repositórios
      const repos = await gitApi.getRepositories(azureProjectId);
      if (!repos || repos.length === 0) continue;

      // Mapear repositórios salvos para referência rápida
      // const savedRepos = await Repository.find({ tenantId, azureProjectId }).lean();
      // const repoMap = new Map<string, any>();
      // savedRepos.forEach(r => repoMap.set(r.azureRepoId, r));

      for (const azureRepo of repos) {
        // 2.1 Upsert Repository
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
          },
          { upsert: true, new: true }
        );
        updatedRepos++;
      }

      // 3. Buscar pipelines associadas a este repositório
      // 3.1 Obter todas as definições de build do projeto
      //const definitions = await buildApi.getDefinitions(azureProject.name);

      // Filtrar definições que usam este repositório
      // const projectDefinitions = definitions.filter(def => {
      //   // Verificar se a definição tem repositório associado
      //   if (!def.project) return false;

      //   return true;
      // });

      // for (const def of projectDefinitions) {
      //   // const definitionId = def.id!;
      //   // const pipelineType = def.type === 1 || def.type === 2 ? 'classic' : 'yaml';

      //   // // Buscar estatísticas de builds (últimos 100)
      //   // const builds = await buildApi.getBuilds(azureProject.name);

      //   // const buildCount = builds ? builds.length : 0;
      //   // let projectAllBuildsFailedCount = 0;
      //   // let lastBuildStatus: BuildResult | undefined;
      //   // let lastBuildDate: Date | undefined;

      //   // if (builds && builds.length > 0) {
      //   //   // Último build (primeiro da lista, pois vem ordenado por data decrescente)
      //   //   const latest = builds[0];
      //   //   lastBuildStatus = latest.result; // 'succeeded', 'failed', 'partiallySucceeded', etc.
      //   //   if (latest.finishTime) {
      //   //     lastBuildDate = new Date(latest.finishTime);
      //   //   } else if (latest.queueTime) {
      //   //     lastBuildDate = new Date(latest.queueTime);
      //   //   }

      //   //   // Contar falhas (status 'failed' ou 'partiallySucceeded')
      //   //   projectAllBuildsFailedCount = builds.filter(b => b.result !== BuildResult.Succeeded).length;

      //   //   // Get builds repository and update repository with build count and failed build count
      //   //   let pipelineCount = 0;
      //   //   builds.forEach(async (b) => {
      //   //     if (b.repository && b.repository.id) {
      //   //       const repo = await Repository.findOne({ tenantId, azureRepoId: b.repository.id });
      //   //       pipelineCount++;
      //   //       if (repo) {
      //   //         repo.buildCount = buildCount;
      //   //         repo.buildfailedCount = builds.filter(b => b.result !== BuildResult.Succeeded).length;
      //   //         repo.buildSucceededCount = builds.filter(b => b.result === BuildResult.Succeeded).length;
      //   //         repo.pipelineCount = pipelineCount;
      //   //         repo.pipelineFailedCount = projectDefinitions.filter(def => (def.type === 1 || def.type === 2) && def.id === b.definition.id).length;
      //   //         repo.pipelineClassicCount = projectDefinitions.filter(def => (def.type === 1 || def.type === 2) && def.id === b.definition.id).length;
      //   //         repo.pipelineYamlCount = projectDefinitions.filter(def => (def.type !== 1 && def.type !== 2) && def.id === b.definition.id).length;

      //   //         await repo.save();
      //   //       }
      //   //     }
      //   //   });

      //   // }

      //     // // Upsert Pipeline
      //     // await Pipeline.findOneAndUpdate(
      //     //   { tenantId, azureDefinitionId: definitionId },
      //     //   {
      //     //     tenantId,
      //     //     repositoryId: savedRepo._id.toString(),
      //     //     name: def.name!,
      //     //     type: pipelineType,
      //     //     azureDefinitionId: definitionId,
      //     //     url: def.url!,
      //     //     lastBuildStatus,
      //     //     lastBuildDate,
      //     //     buildCount,
      //     //     failedBuildCount: projectAllBuildsFailedCount,
      //     //     syncDate: new Date(),
      //     //   },
      //     //   { upsert: true }
      //     // );
      //     // updatedPipelines++;
      //   }
      // }
    }

    return NextResponse.json({
      message: 'Sincronização concluída com sucesso!',
      details: {
        projectsUpdated: updatedProjects,
        repositoriesUpdated: updatedRepos,
        // pipelinesUpdated: updatedPipelines,
      }
    });
  } catch (error: unknown) {
    console.error('Erro na sincronização com Azure DevOps:', error);
    const message = error instanceof Error ? error.message : 'Erro interno ao sincronizar';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}