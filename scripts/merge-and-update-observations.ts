import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

// ============================================================
// CONFIGURAÇÕES
// ============================================================
const INPUT_DIR = path.join(process.cwd(), 'planilhas');
const OUTPUT_FILE = path.join(process.cwd(), 'observations_from_sheets.json');

// Valores padrão para campos obrigatórios
const TENANT_ID = '6a810a476a63372c83d33557';
const DEFAULT_SCAN_ID = '6a93b1410e508962dcd34fa2';
const DEFAULT_PATTERN_ID = '6a823f5a830f2c1c30408d72';
const FIXED_SEEN_DATE = '2026-08-25T04:27:50.396+00:00';
const DEFAULT_SLA_HOURS = 24;

// Mapeamento de grupos (conforme especificado)
const PROJECT_GROUPS: Record<string, string> = {
  GDSAT: 'GDSAT',
  GDSAF: 'GDSAF',
  GEPIN_AS: 'GEPIN_AS',
  GEINI: 'GEINI',
  SIGEP_PB: 'SIGEP_PB',
};

// Totais esperados por grupo (da imagem)
// const EXPECTED = {
//   GDSAT: { total: 206, abertas: 105, resolvidas: 101 },
//   GDSAF: { total: 305, abertas: 52, resolvidas: 253 },
//   GEPIN_AS: { total: 20, abertas: 9, resolvidas: 11 },
//   GEINI: { total: 1, abertas: 1, resolvidas: 0 },
//   SIGEP_PB: { total: 10, abertas: 9, resolvidas: 1 },
// };

const EXPECTED = {
  GDSAT: { total: 335, abertas: 198, resolvidas: 137 },
  GDSAF: { total: 433, abertas: 61, resolvidas: 372 },
  GEPIN_AS: { total: 48, abertas: 15, resolvidas: 33 },
  GEINI: { total: 2, abertas: 1, resolvidas: 1 },
  SIGEP_PB: { total: 10, abertas: 9, resolvidas: 1 },
};

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

// Extrai a data do nome do arquivo (ex: "GDSAT_Observations_2026-08-28.xlsx" -> "2026-08-28")
function getFileDate(fileName: string): string {
  const match = fileName.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '0000-00-00';
}

// Mapeia o status da planilha para o status final
function mapStatus(status: string): string | null {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'resolved') return 'resolved';
  if (normalized === 'recurring') return 'open';
  if (normalized === 'open') return 'open';
  // Ignora outros status (ex: "new" ou vazio)
  return null;
}

// Gera a chave de duplicação
function getDuplicationKey(obs: any): string {
  return `${obs.project}|${obs.repository}|${obs.branch}|${obs.filePath}|${obs.category}`;
}

// Calcula slaDueAt a partir de firstSeen + slaHours
function calculateSlaDueAt(firstSeen: string, slaHours: number): string {
  const date = new Date(firstSeen);
  return new Date(date.getTime() + slaHours * 3600 * 1000).toISOString();
}

// Determina o grupo do projeto
function getProjectGroup(project: string): string {
  for (const [prefix, group] of Object.entries(PROJECT_GROUPS)) {
    if (project.startsWith(prefix)) return group;
  }
  return 'OUTROS';
}

// ============================================================
// LEITURA DAS PLANILHAS
// ============================================================
async function processExcelFile(filePath: string): Promise<any[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet('Observations') || workbook.worksheets[0];
  const results: any[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 5) return; // pula cabeçalhos e resumos

    const project = row.getCell(1).text.trim();
    const repository = row.getCell(2).text.trim();
    const branch = row.getCell(3).text.trim();
    const filePath = row.getCell(4).text.trim();
    const category = row.getCell(5).text.trim();
    const statusRaw = row.getCell(6).text.trim();
    const severity = row.getCell(8).text.trim();
    const slaHours = parseInt(row.getCell(9).text) || DEFAULT_SLA_HOURS;
    const hitCount = parseInt(row.getCell(10).text) || 0;

    // Filtro: apenas categoria desejada
    if (category !== 'Broken Access Control') return;

    // Mapeamento de status
    const status = mapStatus(statusRaw);
    if (!status) return;

    // Extrai nome do arquivo
    const fileName = filePath.split('/').pop() || filePath;

    results.push({
      tenantId: TENANT_ID,
      scanId: DEFAULT_SCAN_ID,
      patternId: DEFAULT_PATTERN_ID,
      query: `file:*Controller.cs AND category:"${category}" AND NOT file:Auth*`,
      category,
      fileName,
      filePath,
      project,
      repository,
      branch,
      hitCount,
      severity,
      slaHours,
      status,
      snippet: null,
      lineNumber: 0,
      hits: [],
      firstSeen: FIXED_SEEN_DATE,
      lastSeen: FIXED_SEEN_DATE,
      slaDueAt: calculateSlaDueAt(FIXED_SEEN_DATE, slaHours),
      // Auxiliar para ordenar por data do arquivo
      _fileDate: getFileDate(path.basename(filePath)),
    });
  });

  return results;
}

// ============================================================
// CONSOLIDAÇÃO
// ============================================================
async function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ Pasta de planilhas não encontrada: ${INPUT_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith('.xlsx'));
  if (files.length === 0) {
    console.log('⚠️ Nenhum arquivo .xlsx encontrado.');
    process.exit(0);
  }

  console.log('📂 Processando planilhas...');
  const allObservations: any[] = [];

  for (const file of files) {
    console.log(`   → ${file}`);
    const data = await processExcelFile(path.join(INPUT_DIR, file));
    allObservations.push(...data);
  }

  // Agrupa por chave de duplicação e mantém o registro com a data mais recente
  const consolidatedMap = new Map<string, any>();
  for (const obs of allObservations) {
    const key = getDuplicationKey(obs);
    const existing = consolidatedMap.get(key);
    if (!existing || obs._fileDate > existing._fileDate) {
      consolidatedMap.set(key, obs);
    }
  }

  // Remove o campo auxiliar _fileDate
  const consolidated = Array.from(consolidatedMap.values()).map(({ _fileDate, ...obs }) => obs);

  // ============================================================
  // VALIDAÇÃO DOS TOTAIS
  // ============================================================
  const stats: Record<string, { total: number; abertas: number; resolvidas: number }> = {};
  for (const obs of consolidated) {
    const group = getProjectGroup(obs.project);
    if (!stats[group]) stats[group] = { total: 0, abertas: 0, resolvidas: 0 };
    stats[group].total++;
    if (obs.status === 'resolved') stats[group].resolvidas++;
    else stats[group].abertas++;
  }

  console.log('\n📊 Resumo por grupo:');
  let allOk = true;

  for (const [group, expected] of Object.entries(EXPECTED)) {
    const actual = stats[group] || { total: 0, abertas: 0, resolvidas: 0 };
    const ok =
      actual.total === expected.total &&
      actual.abertas === expected.abertas &&
      actual.resolvidas === expected.resolvidas;

    if (!ok) allOk = false;
    console.log(
      `${group}: ${actual.total} (${actual.abertas} abertas, ${actual.resolvidas} resolvidas) ${
        ok ? '✅' : `❌ esperado: ${expected.total} (${expected.abertas} abertas, ${expected.resolvidas} resolvidas)`
      }`
    );
  }

  // Grupos não esperados
  for (const [group, actual] of Object.entries(stats)) {
    if (!EXPECTED[group as keyof typeof EXPECTED]) {
      console.log(`${group}: ${actual.total} (${actual.abertas} abertas, ${actual.resolvidas} resolvidas) ⚠️ não esperado`);
      allOk = false;
    }
  }

  const total = consolidated.length;
  const abertas = consolidated.filter((o) => o.status !== 'resolved').length;
  const resolvidas = consolidated.filter((o) => o.status === 'resolved').length;

  console.log(`\nTotal geral: ${total} (${abertas} abertas, ${resolvidas} resolvidas)`);
  // if (total !== 542 || abertas !== 176 || resolvidas !== 366) {
  if (total !== 828 || abertas !== 284 || resolvidas !== 544) {
    allOk = false;
  }

  if (!allOk) {
    console.error('❌ Os totais não batem com o esperado. Verifique as planilhas ou os critérios.');
    process.exit(1);
  }

  // Escreve o JSON final
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(consolidated, null, 2));
  console.log(`\n✅ Arquivo gerado com sucesso: ${OUTPUT_FILE} (${total} registros)`);
  console.log('🎉 Processo concluído!');
}

// Execução
main().catch((error) => {
  console.error('❌ Erro durante a execução:', error);
  process.exit(1);
});