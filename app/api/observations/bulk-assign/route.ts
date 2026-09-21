import { type NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Observation } from "@/models/Observation";
import { requireSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Atualiza parcialmente recurso do endpoint /api/observations/bulk-assign.
 *
 * Este endpoint expõe a operação patch em /api/observations/bulk-assign.
 *
 * @summary Atualiza parcialmente recurso do endpoint /api/observations/bulk-assign
 * @tags Observations, Bulk Assign
 * @route PATCH /api/observations/bulk-assign
 * @async
 * @access Member
 * @function PATCH
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const body = (await req.json()) as {
    observationIds?: string[];
    assignedTo?: string | null;
  };

  const { observationIds, assignedTo } = body;

  if (!Array.isArray(observationIds) || observationIds.length === 0) {
    return NextResponse.json(
      { error: "observationIds deve ser um array não vazio" },
      { status: 400 },
    );
  }

  const validIds = observationIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (validIds.length === 0) {
    return NextResponse.json({ error: "Nenhum ID válido" }, { status: 400 });
  }

  await connectToDatabase();

  const result = await Observation.updateMany(
    { _id: { $in: validIds }, tenantId: auth.user.tenantId },
    { $set: { assignedTo: assignedTo || null } },
  );

  return NextResponse.json({
    matched: result.matchedCount,
    modified: result.modifiedCount,
  });
}
