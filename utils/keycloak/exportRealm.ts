// utils/keycloak/exportRealm.ts
import { adminGet, getAdminAuth, getKeycloakRealm } from "./client";

/**
 * Metadados leves sobre o realm (para preencher a UI antes do export).
 */
export interface KeycloakRealmSummary {
  realm: string;
  users: number;
  clients: number;
  groups: number;
  roles: number;
}

export async function getRealmSummary(): Promise<KeycloakRealmSummary> {
  const { token, mode } = await getAdminAuth();

  const [users, clients, groups, roles] = await Promise.all([
    adminGet<number>("/users/count", token, mode),
    adminGet<number>("/clients/count", token, mode),
    adminGet<number>("/groups/count", token, mode),
    adminGet<Array<unknown>>("/roles", token, mode),
  ]);

  return {
    realm: getKeycloakRealm(),
    users,
    clients,
    groups,
    roles: roles.length,
  };
}

/**
 * Exporta o realm inteiro (exceto senhas) via Admin REST API.
 *
 * O JSON resultante segue o schema `RealmRepresentation` do Keycloak
 * e pode ser reimportado com `--import-realm` ou via Admin Console →
 * "Partial Import".
 *
 * **Limitação**: senhas de usuários **não** vêm. Os usuários precisam
 * redefinir no primeiro login após o import. Para um export completo
 * com senhas, use `exportRealmOffline()` (sidecar).
 */
export async function exportRealmOnline(): Promise<Record<string, unknown>> {
  const { token, mode } = await getAdminAuth();
  const realm = getKeycloakRealm();

  // --- Busca paralela de tudo que compõe o RealmRepresentation ---
  const [
    realmBase,
    clients,
    realmRoles,
    groups,
    users,
    identityProviders,
    authenticationFlows,
    clientScopes,
    defaultGroups,
  ] = await Promise.all([
    adminGet<Record<string, unknown>>("", token, mode),
    adminGet<Array<Record<string, unknown>>>("/clients", token, mode),
    adminGet<Array<Record<string, unknown>>>("/roles", token, mode),
    adminGet<Array<Record<string, unknown>>>(
      "/groups?briefRepresentation=false&populateHierarchy=true",
      token,
      mode,
    ),
    adminGet<Array<Record<string, unknown>>>(
      "/users?max=10000&briefRepresentation=false",
      token,
      mode,
    ),
    adminGet<Array<Record<string, unknown>>>(
      "/identity-provider/instances",
      token,
      mode,
    ),
    adminGet<Array<Record<string, unknown>>>(
      "/authentication/flows",
      token,
      mode,
    ),
    adminGet<Array<Record<string, unknown>>>("/client-scopes", token, mode),
    adminGet<Array<Record<string, unknown>>>(
      "/default-groups",
      token,
      mode,
    ).catch(() => []),
  ]);

  // --- Enriquece cada user com roles e grupos ---
  const usersFull = await Promise.all(
    users.map(async (u) => {
      const userId = u.id as string;
      const [roles, userGroups] = await Promise.all([
        adminGet<Array<{ name: string }>>(
          `/users/${userId}/role-mappings/realm`,
          token,
          mode,
        ).catch(() => []),
        adminGet<Array<{ path: string }>>(
          `/users/${userId}/groups`,
          token,
          mode,
        ).catch(() => []),
      ]);
      return {
        ...u,
        realmRoles: roles.map((r) => r.name),
        groups: userGroups.map((g) => g.path),
      };
    }),
  );

  // Remove campos server-generated que atrapalham o import
  const { id: _discardedRealmId, ...realmClean } = realmBase;

  return {
    ...realmClean,
    realm,
    clients,
    roles: { realm: realmRoles },
    groups,
    users: usersFull,
    identityProviders,
    authenticationFlows,
    clientScopes,
    defaultGroups: defaultGroups.map((g) => g.path),
    _exportedAt: new Date().toISOString(),
    _exportedBy: "debitboard-rest-api",
    _note:
      "Senhas NÃO são exportadas via REST API. Usuários deverão redefinir " +
      "no primeiro login. Para export completo COM senhas, use a opção " +
      "'Export offline'.",
  };
}
