// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeSearch } from '@/lib/azureSearch';
import { getServerAuthSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/models/User';
import { Tenant } from '@/models/Tenant';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settingsHeader = request.headers.get('X-Settings');
    const body = await request.json();

    if (!settingsHeader) {
      return NextResponse.json({ error: 'Configurações não fornecidas.' }, { status: 400 });
    }

    const query = body.searchText || 'ext:cs AllowAnonymous';

    // 🔥 CORREÇÃO: Garante que o Tenant exista para validar a sessão
    await connectToDatabase();
    const dbUser = await User.findOne({ sub: session.user.id });

    let tenant = null;
    const tenantIdCandidate = dbUser?.tenantId;

    if (tenantIdCandidate) {
      tenant = await Tenant.findOne({ uuid: tenantIdCandidate });
    }

    if (!tenant && tenantIdCandidate && mongoose.Types.ObjectId.isValid(tenantIdCandidate)) {
      tenant = await Tenant.findById(tenantIdCandidate);
    }

    if (!tenant || !tenant.azureSettings?.instanceUrl) {
      return NextResponse.json({
        error: 'Configurações do Azure não configuradas para este Tenant. Atualize no painel Admin.'
      }, { status: 400 });
    }

    const { results, hitCount } = await executeSearch(query, session.user.azureSettings, session.user?.azureSettings?.ignoreTlsErrors, session.user.tenantId);

    return NextResponse.json({
      results: { count: hitCount, values: results },
      totalCount: hitCount,
      warning: hitCount > 1000 ? `Resultados truncados em 1000.` : null
    });

  } catch (error: any) {
    console.error('Erro na API de busca:', error.message);
    return NextResponse.json(
      { error: `Falha ao buscar dados do Azure: ${error.message}` },
      { status: 500 }
    );
  }
}