// app/api/search/route.ts
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { executeSearch } from '@/lib/azureSearch';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/models/User';
import { Tenant } from '@/models/Tenant';
import mongoose from 'mongoose';
import { useClientSessionIds } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const {tenantId, userId, azureSettings} = useClientSessionIds();

  try {
    const settingsHeader = req.headers.get('X-Settings');
    const body = await req.json();

    if (!settingsHeader) {
      return NextResponse.json({ error: 'Configurações não fornecidas.' }, { status: 400 });
    }

    const query = body.searchText || 'ext:cs AllowAnonymous';

    // 🔥 CORREÇÃO: Garante que o Tenant exista para validar a sessão
    await connectToDatabase();
    const dbUser = await User.findOne({ sub: userId }).lean();

    let tenant = null;
    const tenantIdCandidate = dbUser?.tenantId;

    if (tenantIdCandidate) {
      tenant = await Tenant.findOne({ uuid: tenantIdCandidate });
    }

    if (!tenant && tenantIdCandidate && mongoose.Types.ObjectId.isValid(tenantIdCandidate)) {
      tenant = await Tenant.findById(tenantIdCandidate);
    }

    if (!tenant || !azureSettings || !tenant.azureSettings?.instanceUrl) {
      return NextResponse.json({
        error: 'Configurações do Azure não configuradas para este Tenant. Atualize no painel Admin.'
      }, { status: 400 });
    }

    const { results, hitCount } = await executeSearch(query, azureSettings, azureSettings?.ignoreTlsErrors, tenantId);

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