import { connectToDatabase } from '../lib/mongodb';
import { Observation } from '../models/Observation';
import { VulnerabilityPattern } from '../models/VulnerabilityPattern';
import type mongoose from 'mongoose';

async function runMigration() {
  console.log('🚀 Conectando ao MongoDB...');
  await connectToDatabase();

  // 🔥 CORREÇÃO CRUCIAL: Utilizamos $where (JavaScript nativo do Mongo)
  // Isso impede que o Mongoose tente fazer o "Cast" do "null" para ObjectId e quebre a query.
  const observations = await Observation.find({
    $or: [
      { patternId: null },
      { patternId: { $in: ["null", ""] } },
      { patternId: { $exists: false } }
    ]
  });

  console.log(`🔍 Encontradas ${observations.length} observations sem padrão válido. Tentando vincular...`);

  if (observations.length === 0) {
    console.log('✅ Nenhuma issue precisa ser atualizada.');
    return;
  }

  const bulkOps: mongoose.AnyBulkWriteOperation<any>[] = [];

  for (const issue of observations) {
    // Busca padrão pela categoria ignorando maiúsculas/minúsculas (case-insensitive)
    const pattern = await VulnerabilityPattern.findOne({
      category: { $regex: new RegExp('^' + issue.category + '$', 'i') }
    });

    if (pattern) {
      bulkOps.push({
        updateOne: {
          filter: { _id: issue._id },
          update: { $set: { patternId: pattern._id } }
        }
      });
    } else {
      console.log(`⚠️ Nenhum padrão encontrado no banco para a categoria: "${issue.category}" (Issue ID: ${issue._id})`);
    }
  }

  if (bulkOps.length > 0) {
    console.log(`🚀 Executando atualização em lote para ${bulkOps.length} observations...`);
    const result = await Observation.bulkWrite(bulkOps);
    console.log(`✅ ${result.modifiedCount} observations atualizadas com sucesso.`);
  }

  console.log('🎉 Migração concluída!');
}

runMigration().catch(console.error);