// scripts/reset-and-migrate-issues.ts
import { connectToDatabase } from '../lib/mongodb';
import { Issue } from '../models/Issue';
import { VulnerabilityPattern } from '../models/VulnerabilityPattern';

async function runMigration() {
  console.log('🚀 Conectando ao MongoDB e corrigindo banco de dados...');
  await connectToDatabase();

  // 1. Força a correção de status (WONT_FIX -> OPEN)
  const statusResult = await Issue.updateMany(
    { status: 'wont_fix' },
    { $set: { status: 'open' } }
  );
  console.log(`✅ Status corrigido: ${statusResult.modifiedCount} issues atualizadas de 'wont_fix' para 'open'.`);

  // 3. Busca issues sem padrão vinculado
  const issues = await Issue.find({ 
    $or: [
      { patternId: { $exists: false } },
      { patternId: null }
    ]
  });

  console.log(`🔍 Encontradas ${issues.length} issues sem padrão. Tentando vincular...`);
  let updatedCount = 0;
  
  for (const issue of issues) {
    // Tenta vincular pela Categoria
    const pattern = await VulnerabilityPattern.findOne({ category: issue.category });
    if (pattern) {
      issue.patternId = pattern._id;
      await issue.save();
      updatedCount++;
    }
  }
  console.log(`✅ ${updatedCount} issues vinculadas a padrões.`);

  console.log('🎉 Migração e reset concluídos! Restart o seu servidor e recarregue a página.');
}

runMigration().catch(console.error);