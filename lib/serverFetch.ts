// lib/serverFetch.ts
import { headers } from 'next/headers';
import type { RequestInit } from 'next/dist/server/web/spec-extension/request';

export async function serverFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headersList = await headers();

  // 1. Construir base URL com protocolo correto (https em dev com --experimental-https)
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'localhost:3000';
  const protocol = headersList.get('x-forwarded-proto') || (process.env.NODE_ENV === 'development' ? 'https' : 'https');
  const baseUrl = `${protocol}://${host}`;
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

  // 2. Repassar cookies e headers essenciais
  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headersList.get('cookie') ? { cookie: headersList.get('cookie')! } : {}),
    ...(headersList.get('authorization') ? { authorization: headersList.get('authorization')! } : {}),
    ...(headersList.get('x-tenant-id') ? { 'x-tenant-id': headersList.get('x-tenant-id')! } : {}),
  };

  // 3. Mesclar headers personalizados
  const mergedHeaders = { ...requestHeaders, ...(options.headers as Record<string, string>) };

  // 4. Em desenvolvimento, aceitar certificados autoassinados (apenas para dev!)
  const fetchOptions: RequestInit = {
    ...options,
    headers: mergedHeaders,
    cache: 'no-store',
  };

  if (process.env.NODE_ENV === 'development') {
    // Ignorar verificação TLS (necessário para `next dev --experimental-https`)
    (fetchOptions as any).agent = new (require('https').Agent)({ rejectUnauthorized: false });
  }

  try {
    const res = await fetch(url, fetchOptions);

    // 5. Não usar redirect() aqui para evitar lançamento de NEXT_REDIRECT
    // Em vez disso, lançar erro de autenticação e deixar o caller decidir
    if (res.status === 401) {
      throw new Error('Unauthorized', { cause: { status: 401 } });
    }

    if (!res.ok) {
      throw new Error(`Erro na requisição (${res.status} ${res.statusText})`);
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    return text ? JSON.parse(text) : (undefined as T);
  } catch (error) {
    throw error; // repassa para o caller
  }
}