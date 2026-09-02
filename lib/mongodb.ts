// lib/mongodb.ts
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// Configuração e cache da conexão
// ============================================================================

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

// Opções recomendadas para produção
const CONNECTION_OPTIONS: mongoose.ConnectOptions = {
  bufferCommands: false, // evita fila de comandos durante reconexão
  serverSelectionTimeoutMS: 5000, // tempo máximo para selecionar servidor
  socketTimeoutMS: 45000, // tempo limite de inatividade da conexão
  family: 4, // prioriza IPv4
};

// Cache global (mantido entre hot-reloads em desenvolvimento)
interface CachedConnection {
  conn: mongoose.Connection | null;
  promise: Promise<typeof mongoose> | null;
}

let cached: CachedConnection = (global as any).mongooseCache;

if (!cached) {
  cached = (global as any).mongooseCache = { conn: null, promise: null };
}

/**
 * Estabelece a conexão com o MongoDB usando singleton com cache.
 * Reutiliza a conexão existente se já estiver ativa.
 */
export async function connectToDatabase(): Promise<mongoose.Connection> {
  // Se já houver uma conexão ativa, retorna-a
  if (cached.conn && cached.conn.readyState === 1) {
    return cached.conn;
  }

  // Se não houver promessa de conexão em andamento, cria uma nova
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, CONNECTION_OPTIONS)
      .then((mongooseInstance) => {
        // Configura eventos de monitoramento (opcional)
        mongooseInstance.connection.on('error', (err) => {
          console.error('❌ MongoDB connection error:', err);
          // Em caso de erro, invalidamos o cache para tentar reconectar depois
          cached.conn = null;
          cached.promise = null;
        });
        mongooseInstance.connection.on('disconnected', () => {
          console.warn('⚠️ MongoDB disconnected. Cache invalidated.');
          cached.conn = null;
          cached.promise = null;
        });
        return mongooseInstance;
      })
      .catch((error) => {
        // Em caso de falha, limpamos a promessa para permitir nova tentativa
        cached.promise = null;
        throw error;
      });
  }

  try {
    const mongooseInstance = await cached.promise;
    cached.conn = mongooseInstance.connection;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw new Error(`Failed to connect to MongoDB: ${error}`);
  }
}

// ============================================================================
// Função para dump do banco de dados (exportação completa para JSON)
// ============================================================================

/**
 * Exporta todas as coleções do banco de dados atual para um arquivo JSON.
 * Cada coleção é salva como uma propriedade de um objeto raiz.
 * @param outputDir - Diretório onde o arquivo será salvo (padrão: './dumps')
 * @param fileName - Nome do arquivo (padrão: 'dump-YYYY-MM-DDTHH-mm-ss.json')
 * @returns Caminho completo do arquivo gerado
 */
export async function dumpDatabase(
  outputDir: string = './dumps',
  fileName?: string
): Promise<string> {
  const conn = await connectToDatabase();
  const db = conn.db;

  if (!db) {
    throw new Error('Database instance not available');
  }

  // Lista todas as coleções
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

  // Objeto que conterá todos os dados
  const dumpData: Record<string, unknown[]> = {};

  for (const name of collectionNames) {
    // Ignora coleções do sistema (opcional)
    if (name.startsWith('system.')) continue;

    const collection = db.collection(name);
    let documents = [];
    
    if (name === 'users' || name === 'tenants' || name === 'vulnerabilitypatterns') {
      documents = await collection.find({}).toArray();
    }

    dumpData[name] = documents;
  }

  // Garante que o diretório existe
  await fs.mkdir(outputDir, { recursive: true });

  // Define o nome do arquivo com timestamp se não fornecido
  if (!fileName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fileName = `dump-${timestamp}.json`;
  }

  const filePath = path.join(outputDir, fileName);

  // Escreve o arquivo com formatação bonita
  await fs.writeFile(filePath, JSON.stringify(dumpData, null, 2), 'utf-8');

  console.log(`✅ Database dump saved to: ${filePath}`);
  return filePath;
}

/**
 * Função auxiliar para restaurar dados a partir de um dump JSON.
 * Atenção: isso sobrescreverá os dados existentes!
 * @param filePath - Caminho do arquivo JSON gerado por dumpDatabase
 */
export async function restoreDatabase(filePath: string): Promise<void> {
  const conn = await connectToDatabase();
  const db = conn.db;

  if (!db) {
    throw new Error('Database instance not available');
  }

  const fileContent = await fs.readFile(filePath, 'utf-8');
  const dumpData: Record<string, unknown[]> = JSON.parse(fileContent);

  for (const [collectionName, documents] of Object.entries(dumpData)) {
    if (!documents.length) continue;

    const collection = db.collection(collectionName);
    // Limpa a coleção antes de inserir (opcional - pode ser removido se quiser apenas adicionar)
    await collection.deleteMany({});
    // Insere os documentos
    await collection.insertMany(documents as any);
    console.log(`✅ Restored ${documents.length} documents into '${collectionName}'`);
  }
}

// ============================================================================
// Utilitário para executar o dump via linha de comando
// (Exemplo: `npx ts-node -r tsconfig-paths/register lib/mongodb.ts --dump`)
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === '--dump') {
    const outputDir = args[1] || './dumps';
    dumpDatabase(outputDir)
      .then(() => process.exit(0))
      .catch((err) => {
        console.error('Dump failed:', err);
        process.exit(1);
      });
  } else if (command === '--restore') {
    const filePath = args[1];
    if (!filePath) {
      console.error('Please provide the file path to restore.');
      process.exit(1);
    }
    restoreDatabase(filePath)
      .then(() => process.exit(0))
      .catch((err) => {
        console.error('Restore failed:', err);
        process.exit(1);
      });
  } else {
    console.log(`
Usage:
  npx ts-node lib/mongodb.ts --dump [outputDir]   # Dump all collections to JSON
  npx ts-node lib/mongodb.ts --restore <file>     # Restore from JSON file
    `);
  }
}