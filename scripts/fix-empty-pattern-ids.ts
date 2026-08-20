// scripts/fix-empty-pattern-ids.ts
import { connectToDatabase } from '../lib/mongodb';
import { Issue } from '../models/Issue';

async function fixEmptyPatternIds() {
  console.log('🚀 Conectando ao MongoDB para limpeza de dados...');
  await connectToDatabase();

  // 🔥 Busca APENAS as issues onde o patternId é uma string vazia.
  // Isso evita o erro de CastError que o updateMany causava.
  const issuesToFix = await Issue.find({
    patternId: { $type: 'string', $eq: "" }
  });

  console.log(`🔍 Encontradas ${issuesToFix.length} issues com patternId como string vazia.`);

  if (issuesToFix.length === 0) {
    console.log('✅ Nenhuma issue com string vazia encontrada. Você está pronto para rodar a migração principal!');
    return;
  }

  let fixedCount = 0;
  for (const issue of issuesToFix) {
    // 🔥 Substitui a string vazia por null, que é o ObjectId vazio válido para o Mongoose.
    issue.patternId = null;
    await issue.save();
    fixedCount++;
  }
  console.log(`✅ ${fixedCount} issues corrigidas com sucesso.`);
  console.log('🎉 Limpeza concluída!');
}

fixEmptyPatternIds().catch(console.error);