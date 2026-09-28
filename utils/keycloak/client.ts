// utils/keycloak/client.ts

/**
 * Base URL do Keycloak para chamadas server-side.
 * Deriva de `KEYCLOAK_ISSUER` (que já existe) removendo o sufixo
 * `/realms/{realm}`.
 */
export function getKeycloakBaseUrl(): string {
  const issuer = process.env.KEYCLOAK_ISSUER;
  if (!issuer) throw new Error("KEYCLOAK_ISSUER não configurado.");
  return issuer.replace(/\/realms\/[^/]+$/, "");
}

export function getKeycloakRealm(): string {
  const issuer = process.env.KEYCLOAK_ISSUER;
  if (!issuer) throw new Error("KEYCLOAK_ISSUER não configurado.");
  const match = issuer.match(/\/realms\/([^/]+)$/);
  if (!match) throw new Error(`KEYCLOAK_ISSUER mal formatado: ${issuer}`);
  return match[1];
}

/**
 * Roles necessárias no client `realm-management` para o export
 * funcionar. Mantido em código para o endpoint de diagnóstico.
 */
export const REQUIRED_REALM_MGMT_ROLES = [
  "view-realm",
  "view-clients",
  "view-users",
  "view-groups",
  "view-identity-providers",
  "view-authorization",
  "query-clients",
  "query-users",
  "query-groups",
] as const;

export type KeycloakAuthMode = "service_account" | "master_admin";

export interface KeycloakAuth {
  token: string;
  mode: KeycloakAuthMode;
}

// ============================================================
// Service account (client_credentials no realm alvo)
// ============================================================
async function getServiceAccountToken(): Promise<string> {
  const base = getKeycloakBaseUrl();
  const realm = getKeycloakRealm();
  const clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID;
  const clientSecret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "KEYCLOAK_ADMIN_CLIENT_ID e KEYCLOAK_ADMIN_CLIENT_SECRET são obrigatórios para service_account.",
    );
  }

  const res = await fetch(
    `${base}/realms/${realm}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Service account auth falhou (HTTP ${res.status}): ${body.slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token)
    throw new Error("Keycloak não retornou access_token.");
  return json.access_token;
}

// ============================================================
// Master admin (password grant no realm `master`)
// ============================================================
async function getMasterAdminToken(): Promise<string> {
  const base = getKeycloakBaseUrl();
  const user = process.env.KEYCLOAK_ADMIN_USER;
  const pass = process.env.KEYCLOAK_ADMIN_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "KEYCLOAK_ADMIN_USER e KEYCLOAK_ADMIN_PASSWORD são obrigatórios para master_admin.",
    );
  }

  const res = await fetch(
    `${base}/realms/master/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: "admin-cli",
        username: user,
        password: pass,
        grant_type: "password",
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Master admin auth falhou (HTTP ${res.status}): ${body.slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token)
    throw new Error("Keycloak não retornou access_token.");
  return json.access_token;
}

// ============================================================
// Fachada pública — tenta service account, cai para master
// ============================================================
let cachedAuth: { auth: KeycloakAuth; expiresAt: number } | null = null;
const TOKEN_TTL_MS = 50_000; // tokens do KC duram ~60s; renova antes.

/**
 * Obtém um token de admin do Keycloak.
 *
 * **Estratégia em cascata**:
 *  1. Se `KEYCLOAK_ADMIN_CLIENT_ID` + `KEYCLOAK_ADMIN_CLIENT_SECRET`
 *     existem, tenta `client_credentials` (boa prática: service account
 *     com roles mínimos em `realm-management`).
 *  2. Se falhar, cai para `admin-cli` com `KEYCLOAK_ADMIN_USER` +
 *     `KEYCLOAK_ADMIN_PASSWORD` contra o realm `master` (fallback robusto).
 *
 * O token é cacheado por ~50s para evitar 1 round-trip por chamada.
 *
 * @throws Se ambos os métodos falharem.
 */
export async function getAdminAuth(): Promise<KeycloakAuth> {
  if (cachedAuth && Date.now() < cachedAuth.expiresAt) {
    return cachedAuth.auth;
  }

  const hasServiceAccount =
    !!process.env.KEYCLOAK_ADMIN_CLIENT_ID &&
    !!process.env.KEYCLOAK_ADMIN_CLIENT_SECRET;

  if (hasServiceAccount) {
    try {
      const token = await getServiceAccountToken();
      cachedAuth = {
        auth: { token, mode: "service_account" },
        expiresAt: Date.now() + TOKEN_TTL_MS,
      };
      return cachedAuth.auth;
    } catch (err) {
      console.warn(
        "[keycloak] service account falhou, tentando master admin:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const token = await getMasterAdminToken();
  cachedAuth = {
    auth: { token, mode: "master_admin" },
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  return cachedAuth.auth;
}

/** Força a próxima chamada a reautenticar. */
export function resetAdminAuth(): void {
  cachedAuth = null;
}

// ============================================================
// GET tipado com erro claro
// ============================================================
export class KeycloakApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly detail: string,
    public readonly mode: KeycloakAuthMode,
  ) {
    super(`GET ${path} falhou (HTTP ${status}): ${detail}`);
  }
}

export async function adminGet<T>(
  path: string,
  token: string,
  mode: KeycloakAuthMode,
): Promise<T> {
  const base = getKeycloakBaseUrl();
  const realm = getKeycloakRealm();
  const res = await fetch(`${base}/admin/realms/${realm}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const detail = body.slice(0, 200) || res.statusText;

    // Se service account tomou 403, tenta master uma vez.
    if (res.status === 403 && mode === "service_account") {
      console.warn(
        `[keycloak] service account sem permissão em ${path}, usando master admin.`,
      );
      const fallback = await getMasterAdminToken();
      cachedAuth = {
        auth: { token: fallback, mode: "master_admin" },
        expiresAt: Date.now() + TOKEN_TTL_MS,
      };
      return adminGet<T>(path, fallback, "master_admin");
    }

    throw new KeycloakApiError(res.status, path, detail, mode);
  }

  return res.json() as Promise<T>;
}
