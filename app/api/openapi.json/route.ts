// app/api/openapi.json/route.ts
import { NextResponse } from "next/server";
import { generate } from "nextjs-auto-swagger-gen";
import type { AutoSwaggerConfig } from "nextjs-auto-swagger-gen";
import {
  OPENAPI_SECURITY_SCHEMES,
  OPENAPI_SCHEMAS,
} from "@/lib/openapi-schemas";

const config: AutoSwaggerConfig = {
  scanner: {
    rootDir: process.cwd(),
    framework: "auto",
    include: ["**/app/**/route.ts"],
    exclude: [
      "**/app/api/auth/**",
      "**/app/api/cron/**",
      "**/app/api/v2/**",
      "**/app/api/openapi.json/**",
      "**/app/api-docs/**",
    ],
  },
  openapi: {
    title: "[db] Debit-Board API",
    version: "2026.9.15",
    description: "API documentation (gerada em runtime)",
    servers: [{ url: "http://localhost:3000", description: "Development" }],
  },
};

type CachedSpec = { json: string; builtAt: number };
let cache: CachedSpec | null = null;
const CACHE_TTL_MS = 5_000;

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
] as const;

function isPublicRoute(path: string): boolean {
  return (
    path.startsWith("/api/auth") ||
    path.startsWith("/api/cron") ||
    path.startsWith("/api/webhooks")
  );
}

function hasExplicitSecurity(operation: Record<string, unknown>): boolean {
  return Array.isArray(operation.security);
}

async function buildSpec(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.builtAt < CACHE_TTL_MS) return cache.json;

  const { spec } = await generate({ rootDir: process.cwd(), config });

  spec.components ??= {};

  spec.components.securitySchemes = {
    ...(spec.components.securitySchemes ?? {}),
    ...OPENAPI_SECURITY_SCHEMES,
  };
  spec.components.schemas = {
    ...(spec.components.schemas ?? {}),
    ...OPENAPI_SCHEMAS,
  };

  spec.security = [{ BearerAuth: [] }];

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!pathItem || isPublicRoute(path)) continue;

    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method] as
        | Record<string, unknown>
        | undefined;
      if (!operation) continue;
      if (hasExplicitSecurity(operation)) continue;

      operation.security = [{ BearerAuth: [] }];
    }
  }

  const json = JSON.stringify(spec, null, 2);
  cache = { json, builtAt: now };
  return json;
}

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

/**
 * @openapi
 * /api/openapi.json:
 *   get:
 *     summary: Retorna o documento OpenAPI da API do Debit-Board
 *     description: |
 *       Gera em runtime o spec OpenAPI 3 a partir dos JSDoc `@openapi`
 *       presentes em cada `route.ts` sob `app/api/`.
 *
 *       **Cache:** o spec é memoizado por 5 segundos.
 *
 *       **Ambiente:** a rota existe apenas em desenvolvimento. Em produção
 *       retorna 404.
 *
 *       **Pós-processamento:**
 *       1. Mescla `securitySchemes` e `schemas` compartilhados de
 *          `lib/openapi-schemas.ts`.
 *       2. Define `security: [{ BearerAuth: [] }]` no root.
 *       3. Reforça `security` em cada operation autenticada (exceto
 *          `/api/auth`, `/api/cron`, `/api/webhooks`).
 *     tags:
 *       - Meta
 *     responses:
 *       200:
 *         description: Documento OpenAPI 3 completo.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 openapi:
 *                   type: string
 *                   example: 3.0.0
 *                 info:
 *                   type: object
 *                 servers:
 *                   type: array
 *                   items:
 *                     type: object
 *                 paths:
 *                   type: object
 *                   additionalProperties: true
 *                 components:
 *                   type: object
 *                   additionalProperties: true
 *       404:
 *         description: Restrita a desenvolvimento.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Not Found
 *       500:
 *         description: Falha ao gerar o spec.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 details:
 *                   type: string
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers,
    });
  }

  try {
    const json = await buildSpec();
    return new NextResponse(json, { headers });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(
      JSON.stringify({ error: "Failed to build spec", details: msg }),
      { status: 500, headers },
    );
  }
}
