#!/usr/bin/env bash
# scripts/keycloak-sync-secrets.sh
#
# Sincroniza os secrets dos clients do Keycloak com os valores do .env.docker.
# Rode APÓS `docker compose up -d debitboard-keycloak` e DEPOIS de qualquer
# `kc.sh import --override true` (que sobrescreve o secret com o placeholder).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.docker"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env.docker não encontrado em $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${KEYCLOAK_ADMIN_USER:=admin}"
: "${KEYCLOAK_ADMIN_PASSWORD:?KEYCLOAK_ADMIN_PASSWORD não definida no .env.docker}"
: "${KEYCLOAK_CLIENT_SECRET:?KEYCLOAK_CLIENT_SECRET não definida no .env.docker}"
: "${KEYCLOAK_ADMIN_CLIENT_SECRET:?KEYCLOAK_ADMIN_CLIENT_SECRET não definida no .env.docker}"

REALM="${KEYCLOAK_REALM:-debit-board}"
KC_CONTAINER="${KEYCLOAK_CONTAINER:-debitboard-keycloak}"
KC_URL="${KEYCLOAK_SERVER_URL:-http://localhost:8080}"
KCADM="docker exec -i $KC_CONTAINER /opt/keycloak/bin/kcadm.sh"

echo "→ Autenticando em $KC_URL (realm master)..."
$KCADM config credentials \
  --server "$KC_URL" \
  --realm master \
  --user "$KEYCLOAK_ADMIN_USER" \
  --password "$KEYCLOAK_ADMIN_PASSWORD" \
  >/dev/null

sync_secret() {
  local client_id="$1"
  local secret="$2"

  local uuid
  uuid=$($KCADM get clients -r "$REALM" -q "clientId=$client_id" \
    --fields id --format csv --noquotes 2>/dev/null | tr -d '\r')

  if [ -z "$uuid" ]; then
    echo "  ⚠  $client_id — client não encontrado"
    return 1
  fi

  # -s secret=<valor>  envia via stdin para não vazar em ps/history
  printf 'secret=%s\n' "$secret" | \
    $KCADM update "clients/$uuid" -r "$REALM" -s - >/dev/null

  echo "  ✓  $client_id — secret atualizado"
}

echo "→ Sincronizando secrets..."
sync_secret "debit-board"          "$KEYCLOAK_CLIENT_SECRET"
sync_secret "debitboard-admin-api" "$KEYCLOAK_ADMIN_CLIENT_SECRET"

echo "✅ Secrets sincronizados."