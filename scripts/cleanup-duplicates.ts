// scripts/cleanup-duplicates.ts
import { connectToDatabase } from '../lib/mongodb';
import { Observation } from '../models/Observation';

async function cleanupDuplicates() {
  console.log('🚀 Conectando ao MongoDB...');
  await connectToDatabase();

  console.log('🔍 Analisando e removendo observações duplicadas...');

  // 1. Agrupar documentos idênticos (mesmo fileName, filePath, project, repository e category)
  // Ordenando por firstSeen/id para preservar o mais antigo e remover os mais recentes
  const duplicates = await Observation.aggregate([
    { $sort: { firstSeen: 1, _id: 1 } },
    {
      $group: {
        _id: {
          tenantId: "$tenantId",
          fileName: "$fileName",
          filePath: "$filePath",
          project: "$project",
          repository: "$repository",
          category: "$category"
        },
        docs: { $push: "$_id" },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ], { allowDiskUse: true });

  const idsToDelete: any[] = [];

  for (const group of duplicates) {
    // Mantém o primeiro (mais antigo) e seleciona os demais (mais recentes) para exclusão
    const [, ...duplicatesToRemove] = group.docs;
    idsToDelete.push(...duplicatesToRemove);
  }

  if (idsToDelete.length > 0) {
    const deleteResult = await Observation.deleteMany({
      _id: { $in: idsToDelete }
    });
    
    console.log(`✅ Remoção concluída: ${deleteResult.deletedCount || idsToDelete.length} duplicatas mais recentes removidas.`);
  } else {
    console.log('✨ Nenhuma duplicata encontrada.');
  }

  console.log('🎉 Processo de limpeza concluído com sucesso!');
  process.exit(0);
}

cleanupDuplicates().catch((error) => {
  console.error('❌ Erro durante a limpeza de duplicatas:', error);
  process.exit(1);
});