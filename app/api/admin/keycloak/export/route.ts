// app/api/admin/keycloak/export/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import {
  exportRealmOnline,
  getRealmSummary,
} from "@/utils/keycloak/exportRealm";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/admin/keycloak/export:
 *   get:
 *     summary: Resumo do realm Keycloak
 *     description: |
 *       Retorna totais de usuários, clients, grupos e roles do realm
 *       configurado. Usado pela UI antes do export para mostrar o que
 *       será incluído.
 *     tags: [Admin, Keycloak]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Sumário do realm.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/KeycloakRealmSummary' }
 *       401:
 *         description: Sessão ausente.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       403:
 *         description: Usuário sem papel de admin.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       500:
 *         description: Falha ao consultar o Keycloak.
 *   post:
 *     summary: Exporta o realm inteiro via Admin REST API (online)
 *     description: |
 *       Monta um `RealmRepresentation` completo e devolve como JSON
 *       para download.
 *
 *       **Não inclui senhas.** Usuários deverão redefinir no primeiro
 *       login após o import. Para export completo com senhas, use
 *       `POST /api/admin/keycloak/export-offline`.
 *     tags: [Admin, Keycloak]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200:
 *         description: JSON do realm para download.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/KeycloakRealmExport' }
 *       403:
 *         description: Usuário sem papel de admin.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 *       500:
 *         description: Falha ao consultar o Keycloak.
 */
export async function GET() {
  const auth = await requireRole(["admin"]);
  if (auth.ok === false) return auth.response;

  try {
    const summary = await getRealmSummary();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[keycloak/export] GET falhou:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Erro ao consultar Keycloak" },
      { status: 500 },
    );
  }
}

export async function POST() {
  const auth = await requireRole(["admin"]);
  if (auth.ok === false) return auth.response;

  try {
    const data = await exportRealmOnline();
    const filename = `realm-${data.realm}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[keycloak/export] POST falhou:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Erro ao exportar realm" },
      { status: 500 },
    );
  }
}
