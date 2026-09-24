// lib/ai/openapi-ingest.ts
import AiEmbedding from "@/models/AiEmbedding";
import { generateEmbedding } from "@/lib/ollama";
import { buildOpenApiSpec } from "@/lib/openapi/build";

interface OperationChunk {
  parentId: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

// lib/ai/openapi-ingest.ts
// (troque apenas a função pickSummary)
function pickSummary(
  operation: Record<string, unknown>,
  method: string,
  path: string,
): string {
  const raw = String(operation.summary ?? "").trim();

  const bad =
    !raw ||
    raw.length < 6 ||
    /^=+$/.test(raw) ||
    /^(content|description|type|properties|required|summary)\s*:/i.test(raw) ||
    /^\d{3}\s*:/.test(raw); // "401:", "404:" etc

  if (!bad) return raw;

  // Fallback: derivar do path
  const segments = path.split("/").filter(Boolean);
  const resource =
    segments[segments.length - 1]?.replace(/[{}]/g, "") ?? "recurso";
  const verbs: Record<string, string> = {
    GET: "Lista",
    POST: "Cria",
    PUT: "Atualiza",
    PATCH: "Atualiza parcialmente",
    DELETE: "Remove",
  };
  return `${verbs[method] ?? method} ${resource}`;
}

function extractOperation(
  path: string,
  method: string,
  operation: Record<string, unknown>,
): OperationChunk {
  const summary = pickSummary(operation, method.toUpperCase(), path);
  const description = (operation.description as string) ?? "";
  const tags = (operation.tags as string[]) ?? [];
  const tagsLine = tags.join(", ");

  const security = Array.isArray(operation.security)
    ? operation.security
        .map((s) => Object.keys(s as object).join("+"))
        .join(", ")
    : "herda do root";

  const params = (operation.parameters as Array<Record<string, unknown>>) ?? [];
  const paramLines = params.map((p) => {
    const name = p.name;
    const loc = p.in;
    const req = p.required ? "obrigatório" : "opcional";
    const schema = p.schema as Record<string, unknown> | undefined;
    const type = schema?.type ?? "any";
    const desc = p.description ?? "";
    return `  - ${name} (${loc}, ${type}, ${req})${desc ? `: ${desc}` : ""}`;
  });

  const requestBody = operation.requestBody as
    | Record<string, unknown>
    | undefined;
  const rbLine = requestBody
    ? `Body: ${JSON.stringify(requestBody.content ?? {}).slice(0, 200)}`
    : null;

  const responses = (operation.responses as Record<string, unknown>) ?? {};
  const responseLines = Object.entries(responses).map(([code, r]) => {
    const rr = r as Record<string, unknown>;
    return `  - ${code}: ${rr.description ?? ""}`;
  });

  const content = [
    `Endpoint: ${method.toUpperCase()} ${path}`,
    summary && `Resumo: ${summary}`,
    tagsLine && `Tags: ${tagsLine}`,
    `Security: ${security}`,
    paramLines.length && `Parâmetros:\n${paramLines.join("\n")}`,
    rbLine,
    responseLines.length && `Respostas:\n${responseLines.join("\n")}`,
    description && `\n${description}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    parentId: `openapi:${method.toUpperCase()}:${path}`,
    title: `${method.toUpperCase()} ${path}`,
    content,
    metadata: {
      path,
      method: method.toUpperCase(),
      tags,
      summary,
    },
  };
}

export async function reconcileOpenApi(): Promise<void> {
  const spec = await buildOpenApiSpec();

  await AiEmbedding.deleteMany({ source: "openapi" });

  let count = 0;

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const operation = pathItem[method] as Record<string, unknown> | undefined;
      if (!operation) continue;

      const chunk = extractOperation(path, method, operation);
      const embedding = await generateEmbedding(chunk.content);

      await AiEmbedding.create({
        source: "openapi",
        parentId: chunk.parentId,
        chunkIndex: 0,
        title: chunk.title,
        content: chunk.content,
        embedding,
        metadata: chunk.metadata,
        updatedAt: new Date(),
      });

      count++;
    }
  }

  console.log(`[ai-ingest] openapi: ${count} endpoint(s) indexado(s)`);
}
