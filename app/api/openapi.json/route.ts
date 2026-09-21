// app/api-docs/openapi.json/route.ts
import { NextResponse } from "next/server";
import { generate } from "nextjs-auto-swagger-gen";
import type { AutoSwaggerConfig } from "nextjs-auto-swagger-gen";

const config: AutoSwaggerConfig = {
  scanner: {
    rootDir: process.cwd(),
    framework: "auto",
    include: ["**/app/**/route.ts"],
    exclude: [
      "**/app/api/auth/**",
      "**/app/api/cron/**",
      "**/app/api/v2/**",
      "**/app/api/openapi/**",
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
  // Rotas que o próprio app trata como públicas
  return (
    path.startsWith("/api/auth") ||
    path.startsWith("/api/cron") ||
    path.startsWith("/api/webhooks")
  );
}

async function buildSpec(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.builtAt < CACHE_TTL_MS) return cache.json;

  const { spec } = await generate({ rootDir: process.cwd(), config });

  // 1) Declara os esquemas de segurança
  spec.components ??= {};
  spec.components.securitySchemes = {
    KeycloakOAuth2: {
      type: "openIdConnect",
      description: "Keycloak — Realm debit-board",
      flows: {
        authorizationCode: {
          authorizationUrl:
            "http://debitboard-keycloak:8080/realms/debit-board/protocol/openid-connect/auth",
          tokenUrl:
            "http://debitboard-keycloak:8080/realms/debit-board/protocol/openid-connect/token",
          scopes: {
            openid: "OpenID",
            profile: "Profile",
            email: "Email",
            groups: "Groups",
            organization: "Organization",
          },
        },
      },
    },
    BearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "JWT do Keycloak (Bearer Token).",
    },
  };

  // 2) Aplica security no root (default para quem respeitar)
  spec.security = [{ BearerAuth: [] }];

  // 3) Garante security em CADA operation — é o que o Akto lê
  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!pathItem || isPublicRoute(path)) continue;

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      operation.security = [{ BearerAuth: [] }];
      // Respeita JSDoc @auth none ou @auth public, se o gerador emitir
      if (operation.security && operation.security.length > 0) continue;
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

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: headers,
    });
  }

  try {
    const json = await buildSpec();
    return new NextResponse(json, {
      headers: headers,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(
      JSON.stringify({ error: "Failed to build spec", details: msg }),
      { status: 500, headers: headers },
    );
  }
}
