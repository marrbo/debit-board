// lib/openapi/build.ts
import { generate } from "nextjs-auto-swagger-gen";
import type { AutoSwaggerConfig } from "nextjs-auto-swagger-gen";
import {
  OPENAPI_SECURITY_SCHEMES,
  OPENAPI_SCHEMAS,
} from "@/lib/openapi-schemas";
import { parseJSDocOperations } from "./parse-jsdoc";

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
] as const;

const OVERLAY_KEYS = [
  "summary",
  "description",
  "tags",
  "responses",
  "parameters",
  "requestBody",
  "security",
  "deprecated",
  "operationId",
] as const;

function isPublicRoute(path: string): boolean {
  return (
    path.startsWith("/api/auth") ||
    path.startsWith("/api/cron") ||
    path.startsWith("/api/webhooks")
  );
}

function hasExplicitSecurity(op: Record<string, unknown>): boolean {
  return Array.isArray(op.security);
}

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

export interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: { url: string; description?: string }[];
  paths: Record<string, Record<string, unknown>>;
  components?: Record<string, unknown>;
  security?: unknown[];
}

export async function buildOpenApiSpec(): Promise<OpenApiSpec> {
  const { spec } = await generate({ rootDir: process.cwd(), config });

  // Overlay: substituir campos do scanner pelos do parser de JSDoc.
  // O `nextjs-auto-swagger-gen` trunca responses e corrompe summary
  // quando o JSDoc tem `description: |` com markdown/tabelas/fences.
  const jsdocOps = parseJSDocOperations(process.cwd());

  for (const [p, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!pathItem) continue;
    for (const method of HTTP_METHODS) {
      const op = (pathItem as Record<string, unknown>)[method] as
        | Record<string, unknown>
        | undefined;
      if (!op) continue;

      const parsed = jsdocOps.get(`${method.toUpperCase()}:${p}`);
      if (!parsed) continue;

      for (const key of OVERLAY_KEYS) {
        if (parsed[key] !== undefined) {
          op[key] = parsed[key];
        }
      }
    }
  }

  // Componentes compartilhados
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

  // Security por operação (exceto rotas públicas)
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

  return spec as OpenApiSpec;
}
