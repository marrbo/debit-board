// scripts/migrate-issues-link-patterns.ts
import { connectToDatabase } from '../lib/mongodb';
import { Issue } from '../models/Issue';
import { VulnerabilityPattern } from '../models/VulnerabilityPattern';

async function migrateIssuePatterns() {
  console.log('🚀 Conectando ao MongoDB...');
  await connectToDatabase();

  // Busca todas as Issues que ainda não possuem patternId
  const issues = await Issue.find({ patternId: { $exists: false } });
  console.log(`🔍 Encontradas ${issues.length} Issues sem padrão vinculado.`);

  let updatedCount = 0;
  for (const issue of issues) {
    // Tenta encontrar um padrão correspondente pela mesma categoria
    // Como podem existir vários padrões com a mesma categoria (ex: Injeção SQL), 
    // pegamos o primeiro para garantir o vínculo.
    const pattern = await VulnerabilityPattern.findOne({ category: issue.category });

    if (pattern) {
      issue.patternId = pattern._id;
      await issue.save();
      updatedCount++;
      console.log(`✅ Issue "${issue.fileName}" vinculada ao padrão: ${pattern.name}`);
    } else {
      console.log(`⚠️ Nenhum padrão encontrado para a categoria: ${issue.category} (Issue: ${issue.fileName})`);
    }
  }

  console.log(`\n🎉 Migração finalizada! ${updatedCount} Issues atualizadas com sucesso.`);
}

migrateIssuePatterns().catch(console.error);