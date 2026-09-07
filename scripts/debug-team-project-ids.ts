import mongoose from 'mongoose';
import { connectToDatabase } from '../lib/mongodb';
import { Project } from '../models/Project';

async function convertTenantIdsToObjectId(): Promise<void> {
  await connectToDatabase();

  // 1. Buscar todos os documentos com tenantId string
  const projectsWithStringTenant = await Project.find({ tenantId: { $type: 'string' } }).lean();
  console.log(`Total de documentos com tenantId string: ${projectsWithStringTenant.length}`);

  // 2. Agrupar por tenantId (string) + azureProjectId
  const groups = new Map<string, typeof projectsWithStringTenant>();

  for (const project of projectsWithStringTenant) {
    const key = `${project.tenantId}_${project.azureProjectId}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(project);
  }

  // 3. Identificar duplicatas e remover as mais antigas (mantendo a mais recente por syncDate ou _id)
  const duplicatesToRemove: mongoose.Types.ObjectId[] = [];

  for (const [key, docs] of groups.entries()) {
    if (docs.length > 1) {
      console.warn(`Duplicatas encontradas para chave "${key}": ${docs.length} documentos.`);
      docs.forEach((doc, index) => {
        console.log(`  - Nome: ${doc.name} | ID: ${doc._id} | syncDate: ${doc.syncDate}`);
      });

      // Ordenar por syncDate (ou _id) decrescente para manter o mais recente
      docs.sort((a, b) => {
        const dateA = a.syncDate ? new Date(a.syncDate).getTime() : 0;
        const dateB = b.syncDate ? new Date(b.syncDate).getTime() : 0;
        return dateB - dateA;
      });

      // O primeiro é mantido, os demais são removidos
      for (let i = 1; i < docs.length; i++) {
        duplicatesToRemove.push(docs[i]._id as mongoose.Types.ObjectId);
      }
    }
  }

  if (duplicatesToRemove.length > 0) {
    console.log(`Removendo ${duplicatesToRemove.length} documento(s) duplicado(s)...`);
    await Project.deleteMany({ _id: { $in: duplicatesToRemove } });
  }

  // 4. Converter os restantes para ObjectId usando pipeline
  const filter = { tenantId: { $type: 'string' } };
  const pipeline = [
    {
      $set: {
        tenantId: {
          $cond: {
            if: { $regexMatch: { input: '$tenantId', regex: /^[0-9a-fA-F]{24}$/ } },
            then: { $toObjectId: '$tenantId' },
            else: '$tenantId' // mantém inválidas como estão
          }
        }
      }
    }
  ];

  const result = await Project.updateMany(
    filter,
    pipeline,
    { updatePipeline: true }
  );

  console.log(`Documentos correspondentes: ${result.matchedCount}`);
  console.log(`Documentos modificados: ${result.modifiedCount}`);
  console.log(`Documentos não convertidos (strings inválidas): ${result.matchedCount - result.modifiedCount}`);

  // Verificação final
  const remainingStrings = await Project.countDocuments({ tenantId: { $type: 'string' } });
  if (remainingStrings > 0) {
    console.warn(`Ainda existem ${remainingStrings} documento(s) com tenantId string (inválidos).`);
  } else {
    console.log('Todos os tenantIds válidos foram convertidos com sucesso.');
  }

  await mongoose.disconnect();
}

convertTenantIdsToObjectId().catch((error) => {
  console.error('Erro na conversão:', error);
  process.exit(1);
});