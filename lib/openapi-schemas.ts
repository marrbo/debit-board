// lib/openapi-schemas.ts
import type { SecurityScheme, SchemaObject } from "nextjs-auto-swagger-gen";

const KEYCLOAK_BASE = "http://debitboard-keycloak:8080/realms/debit-board";
const KEYCLOAK_OPENID = `${KEYCLOAK_BASE}/protocol/openid-connect`;

export const OPENAPI_SECURITY_SCHEMES: Record<string, SecurityScheme> = {
  KeycloakOAuth2: {
    type: "oauth2",
    description: "Keycloak — Realm debit-board",
    flows: {
      authorizationCode: {
        authorizationUrl: `${KEYCLOAK_OPENID}/auth`,
        tokenUrl: `${KEYCLOAK_OPENID}/token`,
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

export const OPENAPI_SCHEMAS: Record<string, SchemaObject> = {
  WikiError: {
    type: "object",
    required: ["error"],
    properties: {
      error: {
        type: "string",
        description: "Mensagem de erro legível.",
        example: "Caminho inválido.",
      },
    },
  },
  AuthError: {
    type: "object",
    required: ["error"],
    properties: {
      error: {
        type: "string",
        enum: ["Unauthorized", "Forbidden", "Locked. Usuário sem Tenant"],
      },
      code: {
        type: "string",
        enum: ["NO_SESSION", "NOT_ADMIN"],
        description: "Código estável para o cliente tratar programaticamente.",
      },
    },
  },
};
