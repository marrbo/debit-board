// utils/keycloak/exportOffline.ts

/**
 * Chama o sidecar `debitboard-realm-exporter` para executar um export
 * offline completo do realm (inclui hashes de senha).
 *
 * O sidecar é o **único** componente com acesso ao `docker.sock`. O
 * app apenas pede o export via HTTP autenticado — não toca em
 * containers.
 *
 * **Custo**: o Keycloak fica indisponível por ~10-30s enquanto o
 * export roda. Requer confirmação explícita do usuário.
 */
export async function exportRealmOffline(): Promise<{
  json: string;
  filename: string;
  tookMs: number;
}> {
  const baseUrl = process.env.EXPORTER_URL;
  const token = process.env.EXPORTER_TOKEN;

  if (!baseUrl || !token) {
    throw new Error(
      "EXPORTER_URL e EXPORTER_TOKEN são obrigatórios. Verifique o docker-compose.",
    );
  }

  const startedAt = Date.now();
  const res = await fetch(`${baseUrl}/export`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 409) {
      throw new Error(
        "Já existe um export em andamento. Tente novamente em instantes.",
      );
    }
    throw new Error(
      `Export offline falhou (HTTP ${res.status}): ${body.slice(0, 200)}`,
    );
  }

  const json = await res.text();
  const realm = process.env.KEYCLOAK_REALM ?? "realm";
  const date = new Date().toISOString().slice(0, 10);
  const filename = `realm-${realm}-full-${date}.json`;

  return {
    json,
    filename,
    tookMs: Date.now() - startedAt,
  };
}
