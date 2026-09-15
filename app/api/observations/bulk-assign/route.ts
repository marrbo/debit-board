import { type NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Observation } from "@/models/Observation";
import { getServerSessionIds } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const sessionIds = await getServerSessionIds();
  const tenantId = sessionIds.tenantId;

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    { _id: { $in: validIds }, tenantId },
    { $set: { assignedTo: assignedTo || null } },
  );

  return NextResponse.json({
    matched: result.matchedCount,
    modified: result.modifiedCount,
  });
}