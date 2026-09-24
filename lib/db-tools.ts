//lib/db-tools.ts
import { MongoClient, type Db, type Document } from "mongodb";
import { EJSON } from "bson";
import { createWriteStream, createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import readline from "node:readline";
import path from "node:path";

// ============================================================
// Constantes
// ============================================================
const DUMP_FORMAT_VERSION = 1;
const MANIFEST_FILE = "manifest.json";
const BATCH_SIZE = 1_000;
const PROGRESS_EVERY = 1_000;

// ============================================================
// Tipos
// ============================================================
export interface CollectionInfo {
  name: string;
  count: number;
}

export interface ServerInfo {
  host: string;
  version: string;
  replicaSet: string | null;
  isPrimary: boolean;
  databases: number;
  collections: number;
  dbName: string;
}

export interface DumpManifest {
  version: number;
  dbName: string;
  createdAt: string;
  collections: CollectionInfo[];
}

export type DumpProgress =
  | { type: "start"; dbName: string; totalCollections: number }
  | { type: "collection-start"; collection: string; index: number }
  | { type: "collection-progress"; collection: string; count: number }
  | { type: "collection-done"; collection: string; count: number }
  | { type: "done"; outputDir: string; totalDocuments: number };

export type RestoreProgress =
  | { type: "start"; dbName: string; totalCollections: number }
  | { type: "collection-start"; collection: string; index: number }
  | { type: "collection-progress"; collection: string; count: number }
  | { type: "collection-done"; collection: string; count: number }
  | { type: "done"; totalDocuments: number };

export interface DumpOptions {
  uri: string;
  outputDir: string;
  dbName?: string;
  onProgress?: (event: DumpProgress) => void;
}

export interface RestoreOptions {
  uri: string;
  inputDir: string;
  dbName?: string;
  dropExisting?: boolean;
  onProgress?: (event: RestoreProgress) => void;
}

// ============================================================
// Helpers internos
// ============================================================
function emit<T>(listener: ((event: T) => void) | undefined, event: T): void {
  listener?.(event);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function resolveDbName(
  client: MongoClient,
  hint?: string,
): Promise<string> {
  if (hint) return hint;

  const fromUri = client.options.dbName;
  if (fromUri) return fromUri;

  const { databases } = await client.db().admin().listDatabases();
  const candidate = databases
    .map((d) => d.name)
    .filter((n) => !["admin", "local", "config"].includes(n))
    .sort()[0];

  if (!candidate) {
    throw new Error("Nenhum banco de dados encontrado para dump");
  }
  return candidate;
}

async function listCollectionNames(db: Db): Promise<string[]> {
  const collections = await db
    .listCollections({}, { nameOnly: true })
    .toArray();

  return collections
    .map((c) => c.name)
    .filter((n) => !n.startsWith("system."))
    .sort();
}

async function writeLine(
  stream: ReturnType<typeof createWriteStream>,
  line: string,
): Promise<void> {
  if (!stream.write(line)) {
    await new Promise<void>((resolve) => stream.once("drain", () => resolve()));
  }
}

async function closeStream(
  stream: ReturnType<typeof createWriteStream>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });
}

// ============================================================
// Dump
// ============================================================
async function dumpCollection(
  db: Db,
  collectionName: string,
  filePath: string,
  onProgress: (count: number) => void,
): Promise<number> {
  const collection = db.collection(collectionName);
  const cursor = collection.find({});
  const output = createWriteStream(filePath, { encoding: "utf8" });

  let count = 0;
  try {
    for await (const doc of cursor) {
      await writeLine(output, EJSON.stringify(doc) + "\n");
      count += 1;
      if (count % PROGRESS_EVERY === 0) onProgress(count);
    }
  } finally {
    await closeStream(output);
  }

  onProgress(count);
  return count;
}

export async function dumpDatabase(
  options: DumpOptions,
): Promise<DumpManifest> {
  const { uri, outputDir, dbName: dbNameHint, onProgress } = options;

  await fs.mkdir(outputDir, { recursive: true });

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const dbName = await resolveDbName(client, dbNameHint);
    const db = client.db(dbName);
    const collectionNames = await listCollectionNames(db);

    emit(onProgress, {
      type: "start",
      dbName,
      totalCollections: collectionNames.length,
    });

    const manifest: DumpManifest = {
      version: DUMP_FORMAT_VERSION,
      dbName,
      createdAt: new Date().toISOString(),
      collections: [],
    };

    let totalDocuments = 0;

    for (let i = 0; i < collectionNames.length; i += 1) {
      const name = collectionNames[i];
      emit(onProgress, {
        type: "collection-start",
        collection: name,
        index: i + 1,
      });

      const filePath = path.join(outputDir, `${sanitizeFilename(name)}.ndjson`);

      const count = await dumpCollection(db, name, filePath, (n) =>
        emit(onProgress, {
          type: "collection-progress",
          collection: name,
          count: n,
        }),
      );

      manifest.collections.push({ name, count });
      totalDocuments += count;

      emit(onProgress, {
        type: "collection-done",
        collection: name,
        count,
      });
    }

    await fs.writeFile(
      path.join(outputDir, MANIFEST_FILE),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );

    emit(onProgress, {
      type: "done",
      outputDir,
      totalDocuments,
    });

    return manifest;
  } finally {
    await client.close();
  }
}

// ============================================================
// Restore
// ============================================================
async function readManifest(inputDir: string): Promise<DumpManifest> {
  const raw = await fs.readFile(path.join(inputDir, MANIFEST_FILE), "utf8");
  const parsed = JSON.parse(raw) as DumpManifest;

  if (parsed.version !== DUMP_FORMAT_VERSION) {
    throw new Error(
      `Versão de manifest incompatível: ${parsed.version} (esperado ${DUMP_FORMAT_VERSION})`,
    );
  }
  return parsed;
}

async function restoreCollection(
  db: Db,
  collectionName: string,
  filePath: string,
  dropExisting: boolean,
  onProgress: (count: number) => void,
): Promise<number> {
  const collection = db.collection(collectionName);

  if (dropExisting) {
    await collection.drop().catch(() => {
      /* coleção pode não existir — ignorar */
    });
  }

  const input = createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  let batch: Document[] = [];
  let count = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    await collection.insertMany(batch, { ordered: false });
    count += batch.length;
    batch = [];
    onProgress(count);
  };

  try {
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      batch.push(EJSON.parse(trimmed) as Document);
      if (batch.length >= BATCH_SIZE) await flush();
    }
    await flush();
  } finally {
    rl.close();
  }

  onProgress(count);
  return count;
}

export async function restoreDatabase(
  options: RestoreOptions,
): Promise<{ totalDocuments: number; collections: CollectionInfo[] }> {
  const {
    uri,
    inputDir,
    dbName: dbNameHint,
    dropExisting = true,
    onProgress,
  } = options;

  const manifest = await readManifest(inputDir);
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const dbName = dbNameHint ?? manifest.dbName;
    const db = client.db(dbName);

    emit(onProgress, {
      type: "start",
      dbName,
      totalCollections: manifest.collections.length,
    });

    const restored: CollectionInfo[] = [];
    let totalDocuments = 0;

    for (let i = 0; i < manifest.collections.length; i += 1) {
      const { name } = manifest.collections[i];
      emit(onProgress, {
        type: "collection-start",
        collection: name,
        index: i + 1,
      });

      const filePath = path.join(inputDir, `${sanitizeFilename(name)}.ndjson`);

      const count = await restoreCollection(
        db,
        name,
        filePath,
        dropExisting,
        (n) =>
          emit(onProgress, {
            type: "collection-progress",
            collection: name,
            count: n,
          }),
      );

      restored.push({ name, count });
      totalDocuments += count;

      emit(onProgress, {
        type: "collection-done",
        collection: name,
        count,
      });
    }

    emit(onProgress, { type: "done", totalDocuments });

    return { totalDocuments, collections: restored };
  } finally {
    await client.close();
  }
}

export async function getServerInfo(
  uri: string,
  dbNameHint?: string,
): Promise<ServerInfo> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5_000 });
  try {
    await client.connect();

    // 🔑 A instância correta é admin().admin()
    //    - client.db("admin") → Db
    //    - .admin()          → Admin (tem listDatabases)
    const adminDb = client.db("admin").admin();

    const hello = (await client.db("admin").command({ hello: 1 })) as Record<
      string,
      unknown
    >;
    const dbName = await resolveDbName(client, dbNameHint);
    const db = client.db(dbName);

    const [dbList, collections] = await Promise.all([
      adminDb.listDatabases(),
      db.listCollections({}, { nameOnly: true }).toArray(),
    ]);

    const hosts =
      (hello.primary as string) ?? (hello.me as string) ?? "unknown";

    return {
      host: hosts,
      version: String(hello.maxWireVersion ?? "unknown"),
      replicaSet: (hello.setName as string) ?? null,
      isPrimary: Boolean(hello.isWritablePrimary),
      databases: dbList.databases.length,
      collections: collections.length,
      dbName,
    };
  } finally {
    await client.close();
  }
}