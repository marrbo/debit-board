/**
 * Verifica a senha do usuário via Keycloak Direct Grant.
 * Retorna true se o token endpoint emitiu um access_token.
 *
 * Requer que o client tenha "Direct Access Grants" habilitado no Keycloak.
 */
export async function verifyKeycloakPassword(
  email: string,
  password: string,
): Promise<boolean> {
  const issuer = process.env.KEYCLOAK_ISSUER;
  const clientId = process.env.KEYCLOAK_CLIENT_ID;
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;

  if (!issuer || !clientId || !clientSecret) return false;

  const body = new URLSearchParams({
    grant_type: "password",
    client_id: clientId,
    client_secret: clientSecret,
    username: email,
    password,
    scope: "openid",
  });

  const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    // timeout curto — não bloquear a request do restore por um IdP lento
    signal: AbortSignal.timeout(5_000),
  });

  return res.ok;
}