import { connectToDatabase } from '../lib/mongodb';
import { Observation } from '../models/Observation';

// Define os campos que devem ser convertidos
const DATE_FIELDS = ['firstSeen', 'lastSeen', 'slaDueAt'] as const;

// Data padrão caso alguma conversão falhe
const FALLBACK_DATE = '2026-08-25T04:27:50.396Z';

async function fixDates() {
  console.log('🚀 Conectando ao MongoDB...');
  await connectToDatabase();

  console.log('🔍 Buscando documentos com datas em formato string...');

  // Filtro: qualquer um dos campos é do tipo string
  const filter = {
    $or: DATE_FIELDS.map((field) => ({ [field]: { $type: 'string' } })),
  };

  const observations = await Observation.find(filter).lean();

  if (observations.length === 0) {
    console.log('✨ Nenhum documento com datas em string encontrado.');
    process.exit(0);
  }

  console.log(`📊 Encontrados ${observations.length} documentos para correção.`);

  let updatedCount = 0;

  for (const obs of observations) {
    const update: Record<string, Date> = {};

    for (const field of DATE_FIELDS) {
      const rawValue = obs[field];

      // Se for string, converte
      if (typeof rawValue === 'string') {
        const parsed = new Date(rawValue);

        // Se a data for inválida, usa fallback
        if (isNaN(parsed.getTime())) {
          console.warn(`⚠️ Data inválida em ${field} (ID: ${obs._id}) → usando fallback`);
          update[field] = new Date(FALLBACK_DATE);
        } else {
          update[field] = parsed;
        }
      }
    }

    // Atualiza apenas se houver alterações
    if (Object.keys(update).length > 0) {
      await Observation.updateOne({ _id: obs._id }, { $set: update });
      updatedCount++;
    }
  }

  console.log(`✅ ${updatedCount} documentos atualizados com sucesso.`);
  console.log('🎉 Processo concluído!');
  process.exit(0);
}

fixDates().catch((error) => {
  console.error('❌ Erro ao corrigir datas:', error);
  process.exit(1);
});