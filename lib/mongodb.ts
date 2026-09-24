import mongoose from 'mongoose';
import fs from 'fs/promises';

interface CachedConnection {
  conn: mongoose.Connection | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: CachedConnection | undefined;
}

// ============================================================================
// Configuração da conexão
// ============================================================================
// 🔥 A URI é lida DENTRO da função, não no top-level do módulo.
//    Motivo: o Turbopack avalia o top-level uma vez no build/cache,
//    congelando o valor que estava no .env.local. Lendo dentro do connect,
//    pegamos sempre o valor vigente em runtime.
// ============================================================================

const CONNECTION_OPTIONS: mongoose.ConnectOptions = {
  bufferCommands: false,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4,
};

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

export async function connectToDatabase(): Promise<mongoose.Connection> {
  // 🔥 Leitura em runtime — sempre pega o valor atual do processo
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('[mongodb] MONGODB_URI não configurada no ambiente');
  }

  console.log('[mongodb] connecting to:', uri);  // debug — remover depois

  if (cached?.conn && cached.conn.readyState === 1) {
    return cached.conn;
  }

  if (!cached?.promise) {
    cached!.promise = mongoose
      .connect(uri, CONNECTION_OPTIONS)
      .then((mongooseInstance) => {
        mongooseInstance.connection.on('error', (err) => {
          console.error('❌ MongoDB connection error:', err);
          cached!.conn = null;
          cached!.promise = null;
        });
        mongooseInstance.connection.on('disconnected', () => {
          console.warn('⚠️ MongoDB disconnected. Cache invalidated.');
          cached!.conn = null;
          cached!.promise = null;
        });
        return mongooseInstance;
      })
      .catch((error) => {
        cached!.promise = null;
        throw error;
      });
  }

  try {
    const mongooseInstance = await cached!.promise;
    cached!.conn = mongooseInstance.connection;
    return cached!.conn;
  } catch (error) {
    cached!.promise = null;
    throw new Error(`Failed to connect to MongoDB: ${error}`);
  }
}

/**
 * Função auxiliar para restaurar dados a partir de um dump JSON.
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
    await collection.deleteMany({});
    await collection.insertMany(documents);
    console.log(`✅ Restored ${documents.length} documents into '${collectionName}'`);
  }
}