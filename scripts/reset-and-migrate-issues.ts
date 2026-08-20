import { connectToDatabase } from '../lib/mongodb';
import { Issue } from '../models/Issue';
import { VulnerabilityPattern } from '../models/VulnerabilityPattern';
import mongoose from 'mongoose';

async function runMigration() {
  console.log('🚀 Conectando ao MongoDB...');
  await connectToDatabase();

  // 🔥 CORREÇÃO CRUCIAL: Utilizamos $where (JavaScript nativo do Mongo)
  // Isso impede que o Mongoose tente fazer o "Cast" do "null" para ObjectId e quebre a query.
  const issues = await Issue.find({
    $where: function() {
      return this.patternId === null || 
             this.patternId === "null" || 
             this.patternId === "" || 
             this.patternId === undefined;
    }
  });

  console.log(`🔍 Encontradas ${issues.length} issues sem padrão válido. Tentando vincular...`);

  if (issues.length === 0) {
    console.log('✅ Nenhuma issue precisa ser atualizada.');
    return;
  }

  const bulkOps: mongoose.AnyBulkWriteOperation<any>[] = [];

  for (const issue of issues) {
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
    console.log(`🚀 Executando atualização em lote para ${bulkOps.length} issues...`);
    const result = await Issue.bulkWrite(bulkOps);
    console.log(`✅ ${result.modifiedCount} issues atualizadas com sucesso.`);
  }

  console.log('🎉 Migração concluída!');
}

runMigration().catch(console.error);