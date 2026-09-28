// app/api/admin/keycloak/export-offline/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { exportRealmOffline } from "@/utils/keycloak/exportOffline";

export const dynamic = "force-dynamic";
// Export offline pode levar até 30s.
export const maxDuration = 60;

/**
 * @openapi
 * /api/admin/keycloak/export-offline:
 *   post:
 *     summary: Export COMPLETO do realm (com senhas) via sidecar
 *     description: |
 *       Chama o sidecar `debitboard-realm-exporter` para executar o
 *       export offline do Keycloak (`kc.sh export --users realm_file`),
 *       que **inclui hashes de senha**.
 *
 *       **Impacto**: o Keycloak fica indisponível por ~10-30 segundos
 *       enquanto o export roda. Nenhum usuário consegue autenticar
 *       nesse intervalo.
 *
 *       O app **não** toca no `docker.sock` — apenas envia uma
 *       requisição HTTP autenticada ao sidecar. Isso garante
 *       isolamento em caso de comprometimento do app.
 *
 *       **Idempotência**: se já houver um export em andamento, o
 *       sidecar devolve 409 e esta rota repassa o erro.
 *     tags: [Admin, Keycloak]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200:
 *         description: JSON completo do realm (com senhas hasheadas).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/KeycloakRealmExport' }
 *       403:
 *         description: Usuário sem papel de admin.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       409:
 *         description: Já existe um export em andamento.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *       500:
 *         description: Falha ao acionar o sidecar ou executar o export.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 */
export async function POST() {
  const auth = await requireRole(["admin"]);
  if (auth.ok === false) return auth.response;

  try {
    const { json, filename, tookMs } = await exportRealmOffline();

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Duration-Ms": String(tookMs),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    const isConflict = message.includes("em andamento");
    console.error("[keycloak/export-offline] falhou:", message);
    return NextResponse.json(
      { error: message },
      { status: isConflict ? 409 : 500 },
    );
  }
}
