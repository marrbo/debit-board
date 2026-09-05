import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

// ============================================================
// CONFIGURAÇÕES
// ============================================================
const INPUT_DIR = path.join(process.cwd(), 'planilhas'); // pasta com os .xlsx
const OUTPUT_FILE = path.join(process.cwd(), 'observations_resolved.json');

// Valores padrão (ajuste conforme seu banco)
const TENANT_ID = '6a810a476a63372c83d33557';
const DEFAULT_SCAN_ID = '6a93b1410e508962dcd34fa2';
const DEFAULT_PATTERN_ID = '6a823f5a830f2c1c30408d72';

// Query padrão (pode ser personalizada por categoria)
function getDefaultQuery(category: string): string {
  return `file:*Controller.cs AND category:"${category}" AND NOT file:Auth*`;
}

interface ObservationInput {
  tenantId: string;
  scanId: string;
  patternId: string;
  query: string;
  category: string;
  fileName: string;
  filePath: string;
  project: string;
  repository: string;
  branch: string;
  hitCount: number;
  severity: string;
  slaHours: number;
  status: 'resolved';
  snippet: null;
  lineNumber: number;
  hits: never[];
}

// ============================================================
// LEITURA E CONSOLIDAÇÃO
// ============================================================
async function processExcelFile(filePath: string): Promise<ObservationInput[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet('Observations') || workbook.worksheets[0];
  const results: ObservationInput[] = [];

  worksheet.eachRow((row, rowNumber) => {
    // Ignora as 5 primeiras linhas (cabeçalhos, títulos, resumos)
    if (rowNumber <= 5) return;

    const project = row.getCell(1).text;
    const repository = row.getCell(2).text;
    const branch = row.getCell(3).text;
    const filePathRaw = row.getCell(4).text;
    const category = row.getCell(5).text;
    const status = row.getCell(6).text;
    const severity = row.getCell(8).text;
    const slaHours = parseInt(row.getCell(9).text) || 24;
    const hitCount = parseInt(row.getCell(10).text) || 0;

    // Filtra apenas registros com status "resolved"
    if (status.trim().toLowerCase() !== 'resolved') return;

    // Extrai nome do arquivo do caminho
    const fileName = filePathRaw.split('/').pop() || filePathRaw;

    results.push({
      tenantId: TENANT_ID,
      scanId: DEFAULT_SCAN_ID,
      patternId: DEFAULT_PATTERN_ID,
      query: getDefaultQuery(category),
      category,
      fileName,
      filePath: filePathRaw,
      project,
      repository,
      branch,
      hitCount,
      severity,
      slaHours,
      status: 'resolved',
      snippet: null,
      lineNumber: 0,
      hits: [],
    });
  });

  return results;
}

async function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ Pasta de planilhas não encontrada: ${INPUT_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.xlsx'));
  if (files.length === 0) {
    console.log('⚠️ Nenhum arquivo .xlsx encontrado na pasta.');
    process.exit(0);
  }

  const allObservations: ObservationInput[] = [];

  for (const file of files) {
    console.log(`📂 Processando ${file}...`);
    const data = await processExcelFile(path.join(INPUT_DIR, file));
    allObservations.push(...data);
  }

  // Remove duplicatas (mesmo project, repository, branch, filePath)
  const seen = new Set<string>();
  const unique: ObservationInput[] = [];

  for (const obs of allObservations) {
    const key = `${obs.project}|${obs.repository}|${obs.branch}|${obs.filePath}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(obs);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(unique, null, 2));
  console.log(`✅ Foram gerados ${unique.length} registros no arquivo ${OUTPUT_FILE}`);
  console.log('🎉 Processo concluído com sucesso!');
}

// Execução
main().catch((error) => {
  console.error('❌ Erro durante a importação:', error);
  process.exit(1);
});