// app/api/observations/[id]/route.ts
import { type NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Observation } from "@/models/Observation";
import { getServerSessionIds } from "@/lib/session-server";

export const dynamic = "force-dynamic";

const PATTERN_SELECT =
  "_id name description recommendation score severity category " +
  "externalId externalLink externalIdCWE externalLinkCWE";

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;

  // 1. Validação do ObjectId — evita cast error no Mongo
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // 2. Sessão / tenant
  const sessionIds = await getServerSessionIds();
  const tenantId = sessionIds.tenantId;

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  // 3. Busca isolada por tenant + populate do pattern
  const observation = await Observation.findOne({
    _id: new mongoose.Types.ObjectId(id),
    tenantId,
  })
    .populate({
      path: "patternId",
      select: PATTERN_SELECT,
    })
    .lean();

  if (!observation) {
    return NextResponse.json(
      { error: "Observation não encontrada" },
      { status: 404 },
    );
  }

  // 4. Enriquecimento na raiz (mesmo formato da rota de lista)
  const pattern = observation.patternId as any;
  if (pattern && typeof pattern === "object") {
    observation.patternName = pattern.name;
    observation.description = pattern.description;
    observation.recommendation = pattern.recommendation;
    observation.pattern = pattern;
  } else {
    observation.patternName = "";
    observation.description = "";
    observation.recommendation = "";
    observation.pattern = null;
  }

  return NextResponse.json(observation);
}