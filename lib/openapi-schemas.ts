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
  SASTPatternOption: {
    type: "object",
    required: ["_id", "name", "category", "severity"],
    properties: {
      _id: { type: "string", description: "ObjectId do pattern." },
      name: { type: "string", description: "Nome do pattern." },
      category: { type: "string", description: "Categoria do pattern." },
      severity: {
        type: "string",
        enum: ["low", "medium", "high", "critical"],
      },
    },
  },
  SASTPatternListResponse: {
    type: "object",
    required: ["patterns"],
    properties: {
      patterns: {
        type: "array",
        items: { $ref: "#/components/schemas/SASTPatternOption" },
      },
    },
  },
  ScanProfile: {
    type: "object",
    required: ["_id", "name", "patternIds"],
    properties: {
      _id: { type: "string" },
      name: { type: "string" },
      description: { type: "string", nullable: true },
      patternIds: {
        type: "array",
        items: { type: "string" },
        description: "ObjectIds dos patterns selecionados.",
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  ScanProfileInput: {
    type: "object",
    required: ["name", "patternIds"],
    properties: {
      name: { type: "string", minLength: 1 },
      description: { type: "string" },
      patternIds: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
  ScanProfileListResponse: {
    type: "object",
    required: ["profiles"],
    properties: {
      profiles: {
        type: "array",
        items: { $ref: "#/components/schemas/ScanProfile" },
      },
    },
  },
  SASTRunRequest: {
    type: "object",
    properties: {
      profileId: {
        type: "string",
        nullable: true,
        description:
          "ObjectId do perfil. Quando ausente/null, todos os patterns ativos são executados (Default).",
      },
    },
  },
};
