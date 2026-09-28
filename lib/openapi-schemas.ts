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
        enum: ["NO_SESSION", "NOT_ADMIN", "INSUFFICIENT_ROLE"],
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
  DashboardWidgetRef: {
    type: "object",
    required: ["widgetId", "visible", "order", "span"],
    properties: {
      widgetId: { type: "string", example: "severity-status" },
      visible: { type: "boolean" },
      order: { type: "integer", minimum: 0 },
      span: { type: "integer", enum: [2, 3, 4, 6] },
    },
  },
  DashboardProfileTV: {
    type: "object",
    required: ["refreshSec", "cycleTeams"],
    properties: {
      teamId: { type: "string", nullable: true },
      refreshSec: { type: "integer", minimum: 0, example: 60 },
      cycleTeams: { type: "boolean", default: false },
    },
  },
  DashboardProfile: {
    type: "object",
    required: ["_id", "name", "kind", "visibility", "layout"],
    properties: {
      _id: { type: "string" },
      name: { type: "string" },
      kind: { type: "string", enum: ["dashboard", "tv"] },
      visibility: {
        type: "string",
        enum: ["private", "shared", "public"],
      },
      layout: {
        type: "array",
        items: { $ref: "#/components/schemas/DashboardWidgetRef" },
      },
      tv: { $ref: "#/components/schemas/DashboardProfileTV" },
      favorites: { type: "array", items: { type: "string" } },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  DashboardProfileInput: {
    type: "object",
    required: ["name", "kind", "visibility", "layout"],
    properties: {
      name: { type: "string", minLength: 1 },
      kind: { type: "string", enum: ["dashboard", "tv"] },
      visibility: {
        type: "string",
        enum: ["private", "shared", "public"],
      },
      layout: {
        type: "array",
        items: { $ref: "#/components/schemas/DashboardWidgetRef" },
      },
      tv: { $ref: "#/components/schemas/DashboardProfileTV" },
    },
  },
  KeycloakRealmSummary: {
    type: "object",
    required: ["realm", "users", "clients", "groups", "roles"],
    properties: {
      realm: { type: "string", example: "debit-board" },
      users: { type: "integer", minimum: 0, example: 42 },
      clients: { type: "integer", minimum: 0, example: 8 },
      groups: { type: "integer", minimum: 0, example: 12 },
      roles: { type: "integer", minimum: 0, example: 25 },
    },
  },
  KeycloakRealmExport: {
    type: "object",
    description:
      "Objeto `RealmRepresentation` do Keycloak. Contém `realm`, `clients`, " +
      "`roles`, `groups`, `users`, `identityProviders`, `authenticationFlows`, " +
      "`clientScopes`, `defaultGroups`. Também carrega campos de auditoria " +
      "(`_exportedAt`, `_exportedBy`, `_note`) que podem ser ignorados no import.",
    additionalProperties: true,
    properties: {
      realm: { type: "string" },
      clients: { type: "array", items: { type: "object" } },
      roles: { type: "object" },
      groups: { type: "array", items: { type: "object" } },
      users: {
        type: "array",
        items: { type: "object" },
        description:
          "Usuários do realm. No export online, o array `credentials` é " +
          "omitido. No export offline, contém os hashes de senha.",
      },
      _exportedAt: { type: "string", format: "date-time" },
      _exportedBy: { type: "string" },
      _note: { type: "string" },
    },
  },
  KeycloakExportOfflineResponse: {
    type: "object",
    required: ["error"],
    properties: {
      error: { type: "string" },
    },
  },
  DashboardProfileListResponse: {
    type: "object",
    required: ["data", "total"],
    properties: {
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/DashboardProfile" },
      },
      total: { type: "integer" },
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
