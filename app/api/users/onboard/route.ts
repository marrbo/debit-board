// app/api/users/onboard/route.ts
import { type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Tenant } from "@/models/Tenant";
import crypto from "crypto";
import { requireSession } from "@/lib/api-auth";

/**
 * Cria recurso do endpoint /api/users/onboard.
 *
 * Este endpoint expõe a operação post em /api/users/onboard.
 *
 * @summary Cria recurso do endpoint /api/users/onboard
 * @tags Users, Onboard
 * @route POST /api/users/onboard
 * @async
 * @function POST
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  await connectToDatabase();
  const body = await req.json();

  const companyName = body.company?.trim() || "Global";
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

  // 2. Atualiza o Ususubio com o tenantUuid
  await User.findOneAndUpdate(
    { sub: auth.user.sub },
    {
      sub: auth.user.sub,
      email: auth.user.email,
      name: body.name,
      company: companyName,
      tenantId: tenantUuid,
      azureSettings: {
        instanceUrl: body.instanceUrl,
        azureCollection: body.azureCollection,
        pat: body.pat,
        username: body.username,
        defaultProject: body.defaultProject,
        reportTitle: body.reportTitle,
      },
      onboardingCompleted: true,
    },
    { upsert: true, new: true },
  );
}
