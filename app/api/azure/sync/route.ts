// app/api/azure/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { Tenant } from '@/models/Tenant';
import { Project } from '@/models/Project';
import { Repository } from '@/models/Repository';
import * as azdev from 'azure-devops-node-api';
import { getPersonalAccessTokenHandler } from 'azure-devops-node-api';

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  // 1. Buscar configurações do Tenant
  const tenant = await Tenant.findById(session.user.tenantId);
  if (!tenant || !tenant.azureSettings || !tenant.azureSettings.instanceUrl || !tenant.azureSettings.pat) {
    return NextResponse.json(
      { error: 'Configurações do Azure DevOps não encontradas para este Tenant.' },
      { status: 400 }
    );
  }

  const { instanceUrl, pat, azureCollection = 'DefaultCollection' } = tenant.azureSettings;

  try {
    // 2. Configurar conexão com Azure DevOps
    const urlWithCollection = `${instanceUrl}/tfs/${azureCollection}/`;
    
    // TODO: Veriricar instanceUrl se termina com / ou se possui /tfs/ ou /tfs ou tfs
    
    const authHandler = getPersonalAccessTokenHandler(pat, true);
    const connection = new azdev.WebApi(urlWithCollection, authHandler, { ignoreSslError: tenant.azureSettings.ignoreTlsErrors });
    const gitApi = await connection.getGitApi();
    const coreApi = await connection.getCoreApi();

    // 3. Buscar todos os projetos (Teams/Projects)
    const projects = await coreApi.getProjects();
    if (!projects || projects.length === 0) {
      return NextResponse.json({ message: 'Nenhum projeto encontrado no Azure.' });
    }

    // 4. Iterar sobre cada projeto e sincronizar
    for (const azureProject of projects) {
      const projectName = azureProject.name!;
      const projectId = azureProject.id!; // GUID do projeto no Azure

      // Upsert do Projeto
      const savedProject = await Project.findOneAndUpdate(
        { tenantId: session.user.tenantId, name: projectName },
        { name: projectName, teamIds: [] },
        { upsert: true, new: true }
      );

      // 5. Buscar repositórios deste projeto
      const repos = await gitApi.getRepositories(projectId);
      if (repos && repos.length > 0) {
        for (const azureRepo of repos) {
          await Repository.findOneAndUpdate(
            {
              tenantId: session.user.tenantId,
              projectId: savedProject._id.toString(),
              name: azureRepo.name!,
            },
            {
              name: azureRepo.name!,
              projectId: savedProject._id.toString(),
              tenantId: session.user.tenantId,
            },
            { upsert: true }
          );
        }
      }
    }

    return NextResponse.json({ message: 'Sincronização concluída com sucesso!' });
  } catch (error: any) {
    console.error('Erro na sincronização com Azure DevOps:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao sincronizar' },
      { status: 500 }
    );
  }
}