import mongoose from 'mongoose';
import fs from 'fs/promises';

// 1. Definimos a interface primeiro
interface CachedConnection {
  conn: mongoose.Connection | null;
  promise: Promise<typeof mongoose> | null;
}

// 2. ESTA É A CHAVE: Aumentamos a definição do objeto global do Node.js
declare global {
  // Usamos 'var' aqui porque é a única forma de adicionar propriedades 
  // ao objeto global em arquivos TypeScript/Node
  var mongooseCache: CachedConnection | undefined;
}

// ============================================================================
// Configuração e cache da conexão
// ============================================================================

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

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

/**
 * Estabelece a conexão com o MongoDB usando singleton com cache.
 */
export async function connectToDatabase(): Promise<mongoose.Connection> {
  if (cached?.conn && cached.conn.readyState === 1) {
    return cached.conn;
  }

  if (!cached?.promise) {
    cached!.promise = mongoose
      .connect(MONGODB_URI, CONNECTION_OPTIONS)
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
