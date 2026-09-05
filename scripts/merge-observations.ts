import fs from 'fs';
import path from 'path';

// ============================================================
// CONFIGURAÇÕES
// ============================================================
const PRIORITY_FILE = path.join(process.cwd(), 'sast_platform.observations.json');
const SECONDARY_FILE = path.join(process.cwd(), 'observations_resolved.json');
const OUTPUT_FILE = path.join(process.cwd(), 'observations_consolidated.json');

// Chave de duplicação: combinação de campos que define uma observação única
function getDuplicationKey(obs: any): string {
  return [
    obs.project,
    obs.repository,
    obs.branch,
    obs.filePath,
    obs.category,
  ].join('|');
}

// ============================================================
// LEITURA E CONSOLIDAÇÃO
// ============================================================
function loadJsonFile(filePath: string): any[] {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function main() {
  console.log('🚀 Iniciando consolidação de observações...');

  // 1. Carregar arquivos
  const priorityObservations = loadJsonFile(PRIORITY_FILE);
  const secondaryObservations = loadJsonFile(SECONDARY_FILE);

  console.log(`📌 Prioridade: ${priorityObservations.length} observações carregadas.`);
  console.log(`📌 Secundário: ${secondaryObservations.length} observações carregadas.`);

  // 2. Criar Set de chaves do arquivo prioritário
  const seenKeys = new Set<string>();
  const consolidated: any[] = [];

  // Adiciona todas as observações do arquivo prioritário
  for (const obs of priorityObservations) {
    const key = getDuplicationKey(obs);
    seenKeys.add(key);
    consolidated.push(obs);
  }

  // 3. Adiciona observações do secundário que não são duplicatas
  let addedCount = 0;
  let duplicateCount = 0;

  for (const obs of secondaryObservations) {
    const key = getDuplicationKey(obs);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      consolidated.push(obs);
      addedCount++;
    } else {
      duplicateCount++;
    }
  }

  // 4. Escrever resultado
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(consolidated, null, 2));

  console.log(`✅ Consolidado gerado com ${consolidated.length} observações.`);
  console.log(`   - Mantidas do arquivo prioritário: ${priorityObservations.length}`);
  console.log(`   - Adicionadas do arquivo secundário: ${addedCount}`);
  console.log(`   - Duplicatas ignoradas: ${duplicateCount}`);
  console.log(`📁 Arquivo salvo em: ${OUTPUT_FILE}`);
  console.log('🎉 Processo concluído com sucesso!');
}

// Execução
main();