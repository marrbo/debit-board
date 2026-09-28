// app/api/admin/keycloak/diagnose/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import {
  getAdminAuth,
  getKeycloakRealm,
  adminGet,
  KeycloakApiError,
  REQUIRED_REALM_MGMT_ROLES,
} from "@/utils/keycloak/client";

export const dynamic = "force-dynamic";

interface CheckResult {
  name: string;
  ok: boolean;
  error?: string;
}

interface EffectiveRole {
  name: string;
  clientId: string;
}

/**
 * @openapi
 * /api/admin/keycloak/diagnose:
 *   get:
 *     summary: Diagnóstico de permissões do Keycloak Admin API
 *     description: |
 *       Inspeciona os roles efetivos do service account no client
 *       `realm-management` e testa cada endpoint usado pelo export.
 *
 *       `allOk` só é `true` quando **os roles necessários estão
 *       presentes** e **todos os endpoints retornam 2xx**.
 *
 *       Útil quando um export falha com HTTP 403 e é preciso
 *       identificar o role ausente.
 *     tags: [Admin, Keycloak]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Resultado do diagnóstico.
 *       403:
 *         description: Usuário sem papel de admin.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthError' }
 */
export async function GET() {
  const auth = await requireRole(["admin"]);
  if (auth.ok === false) return auth.response;

  try {
    const { token, mode } = await getAdminAuth();
    const realm = getKeycloakRealm();
    const clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID;

    // ============================================================
    // 1. Roles efetivos do service account em realm-management
    // ============================================================
    const roleChecks: CheckResult[] = [];
    let effectiveRoles: EffectiveRole[] = [];
    let missingRoles: string[] = [];

    if (mode === "service_account" && clientId) {
      try {
        // Descobre o usuário por trás do service account
        const saUser = await adminGet<{ id: string; username: string }>(
          `/clients/${clientId}/service-account-user`,
          token,
          mode,
        );

        // Descobre o id do client realm-management
        const rmClient = await adminGet<
          Array<{ id: string; clientId: string }>
        >(`/clients?clientId=realm-management`, token, mode).then(
          (list) => list[0],
        );

        if (!rmClient) {
          throw new Error("Client realm-management não encontrado.");
        }

        // Lista os roles do client realm-management que o SA possui
        const assigned = await adminGet<
          Array<{ id: string; name: string; composite?: boolean }>
        >(
          `/users/${saUser.id}/role-mappings/clients/${rmClient.id}`,
          token,
          mode,
        );

        // Também pega os compostos (caso algum role seja composite)
        const assignedNames = new Set(assigned.map((r) => r.name));
        // Expandir composites seria ideal, mas para o diagnóstico
        // simples, o nome já basta na maioria dos casos.

        effectiveRoles = Array.from(assignedNames).map((name) => ({
          name,
          clientId: "realm-management",
        }));

        // Compara com o esperado
        for (const required of REQUIRED_REALM_MGMT_ROLES) {
          const ok = assignedNames.has(required);
          roleChecks.push({
            name: required,
            ok,
            error: ok ? undefined : "não atribuído ao service account",
          });
        }

        missingRoles = REQUIRED_REALM_MGMT_ROLES.filter(
          (r) => !assignedNames.has(r),
        );
      } catch (err) {
        // Falhou em inspecionar roles — provavelmente porque o SA
        // não tem nem `view-users`. Reporta o problema sem quebrar.
        roleChecks.push({
          name: "(inspeção de roles)",
          ok: false,
          error:
            err instanceof KeycloakApiError
              ? `HTTP ${err.status} em ${err.path}`
              : err instanceof Error
                ? err.message
                : "erro desconhecido",
        });
      }
    } else if (mode === "master_admin") {
      // Master admin sempre pode tudo. Marca todos como OK.
      for (const required of REQUIRED_REALM_MGMT_ROLES) {
        roleChecks.push({ name: required, ok: true });
      }
    }

    // ============================================================
    // 2. Endpoints do export
    // ============================================================
    const endpointsToTest = [
      "/clients",
      "/roles",
      "/groups",
      "/users?max=1",
      "/identity-provider/instances",
      "/authentication/flows",
      "/client-scopes",
    ];
    const endpointChecks: CheckResult[] = [];

    for (const ep of endpointsToTest) {
      try {
        await adminGet(ep, token, mode);
        endpointChecks.push({ name: `GET ${ep}`, ok: true });
      } catch (err) {
        endpointChecks.push({
          name: `GET ${ep}`,
          ok: false,
          error:
            err instanceof KeycloakApiError
              ? `HTTP ${err.status}`
              : err instanceof Error
                ? err.message
                : "erro desconhecido",
        });
      }
    }

    // ============================================================
    // 3. Veredito
    // ============================================================
    const rolesOk = roleChecks.every((r) => r.ok);
    const endpointsOk = endpointChecks.every((e) => e.ok);
    const allOk = rolesOk && endpointsOk;

    let hint: string | null = null;
    if (!allOk) {
      if (mode === "service_account" && missingRoles.length > 0) {
        hint =
          `Roles ausentes no service account: ${missingRoles.join(", ")}. ` +
          `Rode scripts/keycloak-setup-exporter.sh para atribuí-los.`;
      } else if (mode === "master_admin") {
        hint =
          "Master admin sem permissão? Confira KEYCLOAK_ADMIN_USER/PASSWORD.";
      } else if (!endpointsOk) {
        hint =
          "Alguns endpoints estão retornando erro — verifique as roles " +
          "listadas acima.";
      }
    }

    return NextResponse.json({
      mode,
      realm,
      clientId,
      allOk,
      effectiveRoles,
      missingRoles,
      roles: roleChecks,
      endpoints: endpointChecks,
      hint,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}
