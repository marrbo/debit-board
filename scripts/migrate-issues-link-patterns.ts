// scripts/migrate-observations-link-patterns.ts
import { connectToDatabase } from '../lib/mongodb';
import { Observation } from '../models/Issue';
import { VulnerabilityPattern } from '../models/VulnerabilityPattern';

async function migrateIssuePatterns() {
  console.log('🚀 Conectando ao MongoDB...');
  await connectToDatabase();

  // Busca todas as Observations que ainda não possuem patternId
  const observations = await Observation.find({ patternId: { $exists: false } });
  console.log(`🔍 Encontradas ${observations.length} Observations sem padrão vinculado.`);

  let updatedCount = 0;
  for (const issue of observations) {
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

  console.log(`\n🎉 Migração finalizada! ${updatedCount} Observations atualizadas com sucesso.`);
}

migrateIssuePatterns().catch(console.error);