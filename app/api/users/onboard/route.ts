// app/api/users/onboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Tenant } from "@/models/Tenant";
import { getServerAuthSession } from "@/lib/auth";
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();
  const body = await req.json();

  const companyName = body.company?.trim() || 'Global';
  let tenantUuid: string;

  // 1. Busca no banco se já existe um Tenant com esse nome
  const existingTenant = await Tenant.findOne({ name: companyName });

  if (existingTenant) {
    // Se já existe, reutiliza o UUID existente!
    tenantUuid = existingTenant.uuid;
  } else {
    // Se não existe, cria um novo Tenant com UUID infalível
    tenantUuid = crypto.randomUUID(); 
    const newTenant = new Tenant({
      uuid: tenantUuid,
      name: companyName,
    });
    await newTenant.save();
  }

  // 2. Atualiza o Usuário com o tenantUuid
  await (User as any).findOneAndUpdate(
    { sub: session.user.id },
    {
      sub: session.user.id,
      email: session.user.email,
      name: body.name,
      company: companyName,
      tenantId: tenantUuid, 
      azureSettings: {
        instanceUrl: body.instanceUrl,
        azureCollection: body.azureCollection,
        pat: body.pat,
        username: body.username,
        defaultProject: body.defaultProject,
        reportTitle: body.reportTitle
      },
      onboardingCompleted: true
    },
    { upsert: true, new: true }
  );

  // FORÇA O NAVEGADOR A IR PARA O DASHBOARD AGORA!
  // return NextResponse.redirect(new URL('/stats', req.url));
}