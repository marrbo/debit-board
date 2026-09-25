// lib/ai/ingest.ts
import fs from "fs";
import crypto from "crypto";
import path from "path";
import AiEmbedding from "@/models/AiEmbedding";
import { generateEmbedding } from "@/lib/ollama";
import { reconcileOpenApi } from "./openapi-ingest";

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 300;
const CHUNK_PARALLELISM = 4;

const WIKI_DIR = path.join(process.cwd(), "content/wiki");
const AI_CONTENT_DIR = path.join(process.cwd(), "content/ai");

const DEPRECATED_SOURCES = [
  "observation",
  "project",
  "repository",
  "savedQuery",
  "team-summary",
  "response-format",
];

let started = false;

/**
 * Divide o texto em chunks menores com sobreposição (overlap).
 * Isso reduz a perda de semântica nas bordas dos blocos durante a busca vetorial.
 */
export function chunkText(
  text: string,
  chunkSize: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP,
): string[] {
  if (!text || text.trim() === "") return [];

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const chunk = text.slice(startIndex, startIndex + chunkSize);
    chunks.push(chunk);

    if (startIndex + chunkSize >= text.length) break;

    startIndex += chunkSize - overlap;
  }

  return chunks;
}

function calculateHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function upsertDoc(
  source: string,
  parentId: string,
  title: string,
  text: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const hash = calculateHash(text);

  const existing = await AiEmbedding.findOne({
    source,
    parentId,
    chunkIndex: 0,
  });
  if (existing && existing.metadata?.hash === hash) {
    return;
  }

  const chunks = chunkText(text, CHUNK_SIZE);
  await AiEmbedding.deleteMany({ source, parentId });

  for (let i = 0; i < chunks.length; i += CHUNK_PARALLELISM) {
    const slice = chunks.slice(i, i + CHUNK_PARALLELISM);
    const embeddings = await Promise.all(
      slice.map((c) => generateEmbedding(c)),
    );
    await AiEmbedding.insertMany(
      slice.map((c, j) => ({
        source,
        parentId,
        chunkIndex: i + j,
        title,
        content: c,
        embedding: embeddings[j],
        metadata: { ...metadata, hash },
        updatedAt: new Date(),
      })),
    );
  }
}

export async function purgeDeprecatedEmbeddings(): Promise<number> {
  const result = await AiEmbedding.deleteMany({
    source: { $in: DEPRECATED_SOURCES },
  });
  if (result.deletedCount > 0) {
    console.log(
      `[ai-ingest] purge: ${result.deletedCount} embedding(s) obsoleto(s) removido(s)`,
    );
  }
  return result.deletedCount;
}

function walkMarkdown(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkMarkdown(full, base));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(path.relative(base, full));
    }
  }
  return out;
}

export async function ingestWikiFile(relativePath: string): Promise<void> {
  const fullPath = path.join(WIKI_DIR, relativePath);
  const content = fs.readFileSync(fullPath, "utf-8");
  const title = relativePath.replace(/\.md$/, "");
  await upsertDoc("wiki", `wiki:${title}`, title, content, {
    path: relativePath,
  });
}

export async function reconcileWiki(onlyFile?: string): Promise<void> {
  if (!fs.existsSync(WIKI_DIR)) return;

  if (onlyFile) {
    await ingestWikiFile(onlyFile);
    console.log(`[ai-ingest] wiki: ${onlyFile} reconciliado`);
    return;
  }

  const files = walkMarkdown(WIKI_DIR);
  for (const f of files) await ingestWikiFile(f);
  console.log(`[ai-ingest] wiki: ${files.length} arquivo(s) reconciliado(s)`);
}

interface AiDoc {
  source: string;
  parentId: string;
  title: string;
  file: string;
}

const AI_DOCS: AiDoc[] = [
  {
    source: "identity",
    parentId: "identity",
    title: "Identidade do DebitBoard",
    file: "identity.md",
  },
  {
    source: "dbql",
    parentId: "dbql-cheatsheet",
    title: "Cheatsheet DBQL",
    file: "dbql-cheatsheet.md",
  },
  {
    source: "glossary",
    parentId: "glossary",
    title: "Glossário PT-EN",
    file: "glossary.md",
  },
];

export async function reconcileAiDocs(): Promise<void> {
  for (const doc of AI_DOCS) {
    const fullPath = path.join(AI_CONTENT_DIR, doc.file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`[ai-ingest] ${doc.file} ausente`);
      continue;
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    await upsertDoc(doc.source, doc.parentId, doc.title, content, {
      file: doc.file,
    });
    console.log(`[ai-ingest] ${doc.source}: reconciliado`);
  }
}

export async function startIngestion(): Promise<void> {
  if (started) return;
  started = true;

  console.log("[ai-ingest] iniciando...");

  await purgeDeprecatedEmbeddings();
  await reconcileWiki();
  await reconcileAiDocs();
  await reconcileOpenApi();

  console.log("[ai-ingest] pronto.");
}
