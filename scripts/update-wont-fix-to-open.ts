// scripts/update-wont-fix-to-open.ts
import { connectToDatabase } from '../lib/mongodb';
import { Observation } from '../models/Observation';

async function migrateWontFixToOpen() {
  console.log('🚀 Conectando ao MongoDB...');
  await connectToDatabase();

  console.log('🔄 Atualizando observations com status "wont_fix" para "open"...');
  const result = await Observation.updateMany(
    { status: 'wont_fix' },
    { $set: { status: 'open' } }
  );

  console.log(`✅ ${result.modifiedCount} observations atualizadas.`);
  console.log('🎉 Migração finalizada!');
}

migrateWontFixToOpen().catch(console.error);