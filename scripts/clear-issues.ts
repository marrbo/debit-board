// scripts/clear-observations.ts
import { connectToDatabase } from '../lib/mongodb';
import { Observation } from '../models/Observation';

async function clearObservations() {
  console.log('🚀 Conectando ao MongoDB...');
  await connectToDatabase();

  console.log('🗑️ Removendo todas as observations do banco de dados...');
  const result = await Observation.deleteMany({});
  
  console.log(`✅ ${result.deletedCount} observations removidas com sucesso!`);
  process.exit(0);
}

clearObservations().catch((error) => {
  console.error('❌ Erro ao limpar observations:', error);
  process.exit(1);
});