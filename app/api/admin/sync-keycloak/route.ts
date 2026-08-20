// app/api/admin/sync-keycloak/route.ts
import { NextResponse } from 'next/server';
import { getServerAuthSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Tenant } from "@/models/Tenant";
import crypto from 'crypto';

export async function POST() {
  const session = await getServerAuthSession();
  // Apenas o Admin pode disparar a sincronização
  if (session?.user?.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Obter Token de Acesso via Client Credentials
    const tokenUrl = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`;
    const authResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.KEYCLOAK_ADMIN_CLIENT_ID!,
        client_secret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET!,
      }),
    });

    if (!authResponse.ok) {
      throw new Error('Falha ao autenticar no Keycloak como Service Account');
    }

    const { access_token } = await authResponse.json();

    // 2. Buscar usuários no Keycloak
    const keycloakAdminUrl = `${process.env.KEYCLOAK_ISSUER?.replace('/realms', '/admin/realms')}/debit-board/users?max=1000`;
    const usersResponse = await fetch(keycloakAdminUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!usersResponse.ok) {
      throw new Error('Erro ao buscar usuários do Keycloak');
    }

    const keycloakUsers = await usersResponse.json();
    await connectToDatabase();

    let created = 0, updated = 0;
    for (const kcUser of keycloakUsers) {
      if (!kcUser.email) continue;

      // 3. Extrair domínio e vincular/criar Tenant
      const domain = kcUser.email.split('@')[1];
      let tenant = await Tenant.findOne({ dominio: domain });
      if (!tenant) {
        tenant = new Tenant({
          uuid: crypto.randomUUID(),
          name: domain, // Nome inicial igual ao domínio
          dominio: domain,
          isActive: false, // O Admin precisa aprovar
          azureSettings: {}
        });
        await tenant.save();
      }

      // 4. Criar ou Atualizar o Usuário local
      const existingUser = await User.findOne({ sub: kcUser.id });
      if (existingUser) {
        await User.updateOne(
          { sub: kcUser.id },
          { email: kcUser.email, name: kcUser.firstName + ' ' + kcUser.lastName, tenantId: tenant._id }
        );
        updated++;
      } else {
        await User.create({
          sub: kcUser.id,
          email: kcUser.email,
          name: kcUser.firstName + ' ' + kcUser.lastName,
          tenantId: tenant._id,
          onboardingCompleted: false, // Pela primeira vez, ele fará o setup de perfil
          isActive: true,
        });
        created++;
      }
    }

    return NextResponse.json({ 
      message: `Sincronização concluída: ${created} usuários criados, ${updated} usuários atualizados.` 
    });

  } catch (error: any) {
    console.error('Erro na sincronização Keycloak:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}