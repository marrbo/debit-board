# 1. Subir a infra
docker compose up -d debitboard-keycloak-db debitboard-keycloak

# 2. Aguardar o Keycloak estar pronto (o log mostra "started in")
until docker exec debitboard-keycloak \
  bash -c "echo > /dev/tcp/localhost/8080" 2>/dev/null; do
  echo "aguardando keycloak..."
  sleep 2
done

# 3. Sincronizar os secrets
chmod +x scripts/keycloak-sync-secrets.sh
./scripts/keycloak-sync-secrets.sh

# 4. Subir o app
docker compose up -d debitboard-app

# 5. Testar
open http://localhost:3001