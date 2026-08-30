// app/api/repository/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Tenant } from '@/models/Tenant';
import { Project } from '@/models/Project';
import { Repository } from '@/models/Repository';

export async function POST(req: NextRequest) {
  const tenantId = req.headers.get('x-tenant-id');

  await connectToDatabase();

  // 2. Buscar Configurações do Tenant
  const tenant = await Tenant.findById(tenantId);
  if (!tenant || !tenant.azureSettings || !tenant.azureSettings.instanceUrl) {
    return NextResponse.json({ error: 'Configurações do Azure não encontradas para este Tenant.' }, { status: 400 });
  }

  const { instanceUrl, azureCollection, pat } = tenant.azureSettings;
  const collection = azureCollection || 'DefaultCollection';

  try {
    // 3. Buscar Projetos do Azure
    const projectsRes = await fetch(
      `${instanceUrl}/${collection}/_apis/projects?api-version=6.0`,
      { headers: { Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}` } }
    );
    
    if (!projectsRes.ok) {
      throw new Error(`Erro na API do Azure (Projetos): ${projectsRes.status}`);
    }

    const projectsData = await projectsRes.json();
    const azureProjects = projectsData.value || [];

    // 4. Iterar sobre cada Projeto e buscar seus Repositórios
    for (const azureProject of azureProjects) {
      const projectId = azureProject.id; // ID do projeto no Azure (GUID)
      const projectName = azureProject.name;

      // Upsert do Projeto no nosso banco
      const savedProject = await Project.findOneAndUpdate(
        { tenantId: tenantId, name: projectName },
        { name: projectName, teamIds: [] },
        { upsert: true, new: true }
      );

      // Buscar os repositórios do projeto no Azure
      const reposRes = await fetch(
        `${instanceUrl}/${collection}/_apis/git/repositories?project=${projectId}&api-version=6.0`,
        { headers: { Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}` } }
      );

      if (reposRes.ok) {
        const reposData = await reposRes.json();
        const azureRepos = reposData.value || [];

        for (const azureRepo of azureRepos) {
          // Upsert do Repositório
          await Repository.findOneAndUpdate(
            { 
              tenantId: tenantId, 
              projectId: savedProject._id.toString(),
              name: azureRepo.name 
            },
            { 
              name: azureRepo.name,
              projectId: savedProject._id.toString(),
              tenantId: tenantId
            },
            { upsert: true }
          );
        }
      }
    }

    return NextResponse.json({ message: 'Sincronização concluída com sucesso!' });

  } catch (error: any) {
    console.error('Erro na sincronização do Azure:', error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}