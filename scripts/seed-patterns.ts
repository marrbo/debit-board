// scripts/seed-patterns.ts
import { connectToDatabase } from '../lib/mongodb';
import { VulnerabilityPattern } from '../models/VulnerabilityPattern';

const patterns = [
  {
    name: 'AllowAnonymous em Controllers',
    queryPattern: 'ext:cs AllowAnonymous',
    severity: 'high',
    category: 'Autenticação',
    description: 'Endpoint público sem autenticação',
    externalId: 'OWASP-2021-A7',
    externalLink: 'https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/',
    reference: 'OWASP Top 10 2021 - A7: Identification and Authentication Failures',
    slaHours: 24, // deve ser corrigido em 24h
    enabled: true,
  },
  {
    name: 'SQL Injection com concatenação',
    queryPattern: 'ext:cs "+ " OR "+ "',
    severity: 'critical',
    category: 'Injeção SQL',
    description: 'Concatenação de strings em consultas SQL',
    externalId: 'OWASP-2021-A3',
    externalLink: 'https://owasp.org/Top10/A03_2021-Injection/',
    reference: 'OWASP Top 10 2021 - A3: Injection',
    slaHours: 4, // crítico deve ser corrigido em 4h
    enabled: true,
  },
  {
    name: 'Hardcoded Secrets',
    queryPattern: 'ext:cs "password" OR "apikey" OR "secret"',
    severity: 'critical',
    category: 'Segredos',
    description: 'Senhas ou chaves de API hardcoded',
    externalId: 'CWE-798',
    externalLink: 'https://cwe.mitre.org/data/definitions/798.html',
    reference: 'CWE-798: Use of Hard-coded Credentials',
    slaHours: 4,
    enabled: true,
  },
  {
    name: 'Authorize Attribute Faltando',
    queryPattern: 'ext:cs "[Authorize]"',
    severity: 'medium',
    category: 'Autenticação',
    description: 'Verifica se o atributo [Authorize] está presente em controllers',
    externalId: 'OWASP-2021-A7',
    externalLink: 'https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/',
    reference: 'OWASP Top 10 2021 - A7: Identification and Authentication Failures',
    slaHours: 48,
    enabled: true,
  },
];

async function seedPatterns() {
  console.log('🚀 Conectando ao MongoDB...');
  await connectToDatabase();

  console.log('🔍 Verificando se já existem padrões...');
  const count = await VulnerabilityPattern.countDocuments();
  if (count > 0) {
    console.log(`✅ Já existem ${count} padrões. Nenhuma ação necessária.`);
    process.exit(0);
  }

  console.log('📝 Inserindo padrões de vulnerabilidade...');
  await VulnerabilityPattern.insertMany(patterns);
  console.log('✅ Padrões inseridos com sucesso!');
  process.exit(0);
}

seedPatterns().catch((error) => {
  console.error('❌ Erro ao popular padrões:', error);
  process.exit(1);
});