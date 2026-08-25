// scripts/migrate-observations-sla.ts
import { connectToDatabase } from '../lib/mongodb';
import { Observation } from '../models/Observation';
import { VulnerabilityPattern } from '../models/VulnerabilityPattern';

async function migrateObservationsSLA() {
  console.log('🚀 Conectando ao MongoDB...');
  await connectToDatabase();

  console.log('🔍 Buscando Observations existentes...');
  const observations = await Observation.find({});
  console.log(`📊 Encontradas ${observations.length} Observations.`);

  if (observations.length === 0) {
    console.log('✅ Nenhuma Issue para atualizar. Encerrando.');
    process.exit(0);
  }

  console.log('🔄 Processando Observations...');
  
  const updates: any[] = [];
  let skipped = 0;
  let updated = 0;

  for (const issue of observations) {
    try {
      // Busca o padrão de vulnerabilidade correspondente a esta Issue
      const pattern = await VulnerabilityPattern.findById(issue.patternId).lean();

      if (!pattern) {
        skipped++;
        continue; // Pula se o padrão tiver sido deletado
      }

      // Define valores com fallback para evitar erros de modelo
      const severity = pattern.severity || 'medium';
      const slaHours = pattern.slaHours || 72;

      // Calcula o SLA Due Date baseado no First Seen + SLA Hours
      const firstSeen = new Date(issue.firstSeen);
      const slaDueAt = new Date(firstSeen.getTime() + slaHours * 3600 * 1000);

      updates.push({
        updateOne: {
          filter: { _id: issue._id },
          update: {
            $set: {
              severity,
              slaHours,
              slaDueAt,
            },
          },
        },
      });

      updated++;
    } catch (error) {
      console.error(`❌ Erro ao processar Issue ${issue._id}:`, error);
    }
  }

  if (updates.length > 0) {
    console.log(`📝 Aplicando atualizações em lote (${updates.length} Observations)...`);
    const result = await Observation.bulkWrite(updates);
    console.log(`✅ ${result.modifiedCount} Observations atualizadas com sucesso.`);
  } else {
    console.log('⚠️ Nenhuma atualização realizada.');
  }

  if (skipped > 0) {
    console.log(`⚠️ ${skipped} Observations foram ignoradas (padrão de vulnerabilidade não encontrado).`);
  }

  console.log('🎉 Migração concluída!');
  process.exit(0);
}

migrateObservationsSLA().catch((error) => {
  console.error('❌ Erro fatal durante a migração:', error);
  process.exit(1);
});