// scripts/migrate-isactive.ts
import { connectToDatabase } from '../lib/mongodb';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';

async function migrate() {
  console.log('🚀 Conectando ao MongoDB...');
  await connectToDatabase();

  console.log('🔄 Adicionando campo isActive: true para todos os Tenants...');
  const tenantResult = await Tenant.updateMany(
    { isActive: { $exists: false } }, // Só atualiza quem ainda não tem o campo
    { $set: { isActive: true } }
  );
  console.log(`✅ Tenants atualizados: ${tenantResult.modifiedCount}`);

  console.log('🔄 Adicionando campo isActive: true para todos os Usuários...');
  const userResult = await User.updateMany(
    { isActive: { $exists: false } }, // Só atualiza quem ainda não tem o campo
    { $set: { isActive: true } }
  );
  console.log(`✅ Usuários atualizados: ${userResult.modifiedCount}`);

  console.log('🎉 Migração concluída com sucesso!');
  process.exit(0);
}

migrate().catch((error) => {
  console.error('❌ Erro durante a migração:', error);
  process.exit(1);
});