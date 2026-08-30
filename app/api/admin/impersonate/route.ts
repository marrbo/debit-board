// app/api/admin/impersonate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  // Verifica se quem está fazendo a requisição é o Admin
  const adminSession = await getServerAuthSession();
  if (adminSession?.user?.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Pega o ID do usuário alvo enviado no corpo da requisição
  const body = await req.json();
  const targetUserId = body.userId;

  if (!targetUserId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  // Cria o cookie seguro de impersonação
  const cookieStore = await cookies();
  cookieStore.set('impersonating_user', targetUserId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 15, // 15 minutos de sessão
    path: '/',
  });

  return NextResponse.json({ success: true });
}