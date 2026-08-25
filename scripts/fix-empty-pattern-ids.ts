// scripts/fix-empty-pattern-ids.ts
import { connectToDatabase } from '../lib/mongodb';
import { Observation } from '../models/Observation';

async function fixEmptyPatternIds() {
  console.log('🚀 Conectando ao MongoDB para limpeza de dados...');
  await connectToDatabase();

  // 🔥 Busca APENAS as observations onde o patternId é uma string vazia.
  // Isso evita o erro de CastError que o updateMany causava.
  const observationsToFix = await Observation.find({
    patternId: { $type: 'string', $eq: "" }
  });

  console.log(`🔍 Encontradas ${observationsToFix.length} observations com patternId como string vazia.`);

  if (observationsToFix.length === 0) {
    console.log('✅ Nenhuma issue com string vazia encontrada. Você está pronto para rodar a migração principal!');
    return;
  }

  let resolvedCount = 0;
  for (const issue of observationsToFix) {
    // 🔥 Substitui a string vazia por null, que é o ObjectId vazio válido para o Mongoose.
    issue.patternId = null;
    await issue.save();
    resolvedCount++;
  }
  console.log(`✅ ${resolvedCount} observations corrigidas com sucesso.`);
  console.log('🎉 Limpeza concluída!');
}

fixEmptyPatternIds().catch(console.error);