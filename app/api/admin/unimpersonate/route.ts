// app/api/admin/unimpersonate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  // Busca a sessão do usuário logado
  const session = await getServerAuthSession();

  // Verificação direta: Se não estiver logado ou não for o Admin, recusa
//   if (!session || session?.user?.email !== process.env.ADMIN_EMAIL) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   }

  // Remove o cookie de impersonação
  const cookieStore = cookies();
  cookieStore.delete('impersonating_user');

  return NextResponse.json({ success: true });
}