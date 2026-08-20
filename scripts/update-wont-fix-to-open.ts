// scripts/update-wont-fix-to-open.ts
import { connectToDatabase } from '../lib/mongodb';
import { Issue } from '../models/Issue';

async function migrateWontFixToOpen() {
  console.log('🚀 Conectando ao MongoDB...');
  await connectToDatabase();

  console.log('🔄 Atualizando issues com status "wont_fix" para "open"...');
  const result = await Issue.updateMany(
    { status: 'wont_fix' },
    { $set: { status: 'open' } }
  );

  console.log(`✅ ${result.modifiedCount} issues atualizadas.`);
  console.log('🎉 Migração finalizada!');
}

migrateWontFixToOpen().catch(console.error);