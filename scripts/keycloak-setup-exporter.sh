#!/usr/bin/env bash
# scripts/keycloak-setup-exporter.sh
#
# Atribui os roles necessários em `realm-management` ao service account
# do client `KEYCLOAK_ADMIN_CLIENT_ID`.
#
# Uso:
#   KEYCLOAK_ADMIN_URL=http://localhost:8080 \
#   KEYCLOAK_REALM=debit-board \
#   KEYCLOAK_ADMIN_USER=admin \
#   KEYCLOAK_ADMIN_PASSWORD=admin \
#   KEYCLOAK_ADMIN_CLIENT_ID=debitboard-admin-api \
#   ./scripts/keycloak-setup-exporter.sh
#
# Requer o container `debitboard-keycloak` em execução com `kcadm.sh`
# disponível (vem na imagem oficial).

set -euo pipefail

KC_URL="${KEYCLOAK_ADMIN_URL:-http://localhost:8080}"
REALM="${KEYCLOAK_REALM:-debit-board}"
ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
CLIENT_ID="${KEYCLOAK_ADMIN_CLIENT_ID:?KEYCLOAK_ADMIN_CLIENT_ID é obrigatório}"

echo ${ADMIN_USER}
echo ${ADMIN_PASS}

# Roles mínimos necessários para o export funcionar.
ROLES=(
  "view-realm"
  "view-clients"
  "view-users"
  "view-groups"
  "view-identity-providers"
  "view-authorization"
  "query-clients"
  "query-users"
  "query-groups"
)

SERVICE_ACCOUNT="service-account-${CLIENT_ID}"

echo "→ Autenticando como ${ADMIN_USER} em ${KC_URL}…"
docker exec debitboard-keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server "${KC_URL}" \
  --realm master \
  --user "${ADMIN_USER}" \
  --password "${ADMIN_PASS}"

echo "→ Atribuindo roles a ${SERVICE_ACCOUNT}…"
for role in "${ROLES[@]}"; do
  echo "   • ${role}"
  docker exec debitboard-keycloak /opt/keycloak/bin/kcadm.sh add-roles \
    -r "${REALM}" \
    --uusername "${SERVICE_ACCOUNT}" \
    --cclientid "realm-management" \
    --rolename "${role}" 2>/dev/null || \
    echo "     (role já atribuído ou nome difere — verifique no console)"
done

echo "✓ Pronto. Teste em: /api/admin/keycloak/diagnose"