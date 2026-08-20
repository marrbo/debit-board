// scripts/clear-issues.ts
import { connectToDatabase } from '../lib/mongodb';
import { Issue } from '../models/Issue';

async function clearIssues() {
  console.log('🚀 Conectando ao MongoDB...');
  await connectToDatabase();

  console.log('🗑️ Removendo todas as issues do banco de dados...');
  const result = await Issue.deleteMany({});
  
  console.log(`✅ ${result.deletedCount} issues removidas com sucesso!`);
  process.exit(0);
}

clearIssues().catch((error) => {
  console.error('❌ Erro ao limpar issues:', error);
  process.exit(1);
});