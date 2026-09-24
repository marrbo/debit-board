// lib/openapi/parse-jsdoc.ts
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
] as const;

export interface ParsedOperation {
  path: string;
  method: string;
  operation: Record<string, unknown>;
}

interface RawBlock {
  dedented: string;
  raw: string;
}

function walkRoutes(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkRoutes(full, acc);
    else if (e.isFile() && e.name === "route.ts") acc.push(full);
  }
  return acc;
}

/**
 * Extrai blocos `@openapi` de um arquivo `.ts` e devolve duas versões:
 *
 * - `dedented`: com a indentação comum removida — funciona na maioria
 *   dos casos, porque o JSDoc costuma ter um único nível de indentação
 *   (o ` * ` que já foi removido).
 * - `raw`: sem dedent — preserva a indentação relativa de block scalars
 *   (`description: |`) quando o dedent global quebra o alinhamento.
 *
 * O parser tenta `dedented` primeiro e cai para `raw` em caso de falha.
 */
function extractOpenApiBlocks(source: string): RawBlock[] {
  const blocks: RawBlock[] = [];
  const regex = /\/\*\*([\s\S]*?)\*\//g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(source)) !== null) {
    const body = m[1];
    if (!body.includes("@openapi")) continue;

    const lines = body.split("\n").map((l) => l.replace(/^\s*\*\s?/, ""));
    const start = lines.findIndex((l) => l.trim().startsWith("@openapi"));
    if (start === -1) continue;

    const yamlLines = lines.slice(start + 1);
    while (yamlLines.length && !yamlLines[yamlLines.length - 1].trim()) {
      yamlLines.pop();
    }

    const nonEmpty = yamlLines.filter((l) => l.trim());
    if (nonEmpty.length === 0) continue;

    const minIndent = Math.min(
      ...nonEmpty.map((l) => l.match(/^(\s*)/)?.[1].length ?? 0),
    );

    blocks.push({
      dedented: yamlLines.map((l) => l.slice(minIndent)).join("\n"),
      raw: yamlLines.join("\n"),
    });
  }

  return blocks;
}

/**
 * Lê todos os `route.ts` em `app/` e devolve um mapa
 * `METHOD:path` → operation do OpenAPI, extraído diretamente do
 * JSDoc `@openapi`.
 *
 * Usado como overlay sobre o spec do `nextjs-auto-swagger-gen`, que
 * trunca responses e corrompe summary em blocos `description: |`
 * contendo markdown complexo (tabelas, code fences, listas).
 */
export function parseJSDocOperations(
  rootDir: string,
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  const appDir = path.join(rootDir, "app");
  const files = walkRoutes(appDir);

  for (const file of files) {
    let source: string;
    try {
      source = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    for (const block of extractOpenApiBlocks(source)) {
      let doc: unknown;
      let usedRaw = false;

      // Tentativa 1: bloco dedentado
      try {
        doc = yaml.load(block.dedented);
      } catch {
        // Tentativa 2: bloco cru — preserva indentação relativa de
        // block scalars que o dedent global pode ter quebrado
        try {
          doc = yaml.load(block.raw);
          usedRaw = true;
        } catch (err2) {
          console.warn(
            `[openapi-parse] YAML inválido em ${path.relative(rootDir, file)}:`,
            (err2 as Error).message,
          );
          continue;
        }
      }

      if (!doc || typeof doc !== "object") continue;

      if (usedRaw) {
        console.log(
          `[openapi-parse] fallback raw usado em ${path.relative(rootDir, file)}`,
        );
      }

      for (const [p, pathItem] of Object.entries(
        doc as Record<string, unknown>,
      )) {
        if (!p.startsWith("/") || !pathItem || typeof pathItem !== "object") {
          continue;
        }
        for (const method of HTTP_METHODS) {
          const op = (pathItem as Record<string, unknown>)[method];
          if (!op || typeof op !== "object") continue;
          map.set(
            `${method.toUpperCase()}:${p}`,
            op as Record<string, unknown>,
          );
        }
      }
    }
  }

  return map;
}
