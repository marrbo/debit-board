// app/api/observations/[id]/route.ts
import { type NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Observation } from "@/models/Observation";
import { User } from "@/models/User";
import { requireSession } from "@/lib/api-auth";
import { recordUserEvent } from "@/lib/observation-events";
import type { ObservationStatus } from "@/types/IObservation";

export const dynamic = "force-dynamic";

const VALID_STATUS: ObservationStatus[] = [
  "open",
  "resolved",
  "wont_fix",
  "expired",
];

const PATTERN_SELECT =
  "_id name description recommendation score severity category " +
  "externalId externalLink externalIdCWE externalLinkCWE";

/**
 * Lista recursos do endpoint /api/observations/{id}.
 *
 * Este endpoint expõe a operação get em /api/observations/{id}.
 *
 * @summary Lista recursos do endpoint /api/observations/{id}
 * @tags Observations, Id
 * @route GET /api/observations/{id}
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
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
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;
  const tenantId = auth.user.tenantId;

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

/**
 * Atualiza status e/ou responsável de uma observation e registra o
 * evento correspondente na timeline.
 *
 * Body:
 *   { status?: ObservationStatus, assignedTo?: string | null }
 *
 * @summary Atualiza observation (status, responsável)
 * @tags Observations, Id
 * @route PATCH /api/observations/{id}
 */
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;

  const observationId = mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(id)
    : null;
  if (!observationId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantId = auth.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const rawStatus: unknown = body?.status;
  const nextStatus: ObservationStatus | null =
    typeof rawStatus === "string" &&
    VALID_STATUS.includes(rawStatus as ObservationStatus)
      ? (rawStatus as ObservationStatus)
      : null;

  const hasAssigneeField = Object.prototype.hasOwnProperty.call(
    body ?? {},
    "assignedTo",
  );
  const rawAssignee: unknown = body?.assignedTo;
  const nextAssignee: string | null =
    rawAssignee === null
      ? null
      : typeof rawAssignee === "string"
        ? rawAssignee
        : (undefined as unknown as string);

  if (nextStatus === null && !hasAssigneeField) {
    return NextResponse.json(
      { error: "Nada a atualizar. Envie `status` ou `assignedTo`." },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const observation = await Observation.findOne({
    _id: observationId,
    tenantId,
  }).select({
    _id: 1,
    status: 1,
    assignedTo: 1,
    patternId: 1,
  });

  if (!observation) {
    return NextResponse.json(
      { error: "Observation não encontrada." },
      { status: 404 },
    );
  }

  const dbUser = await User.findOne({ sub: auth.user.sub })
    .select("_id name email")
    .lean();
  const actorName = dbUser?.name ?? dbUser?.email ?? auth.user.sub;
  const actorId = dbUser?._id;

  const now = new Date();
  const $set: Record<string, unknown> = {};

  // ---------- status ----------
  if (nextStatus !== null && nextStatus !== observation.status) {
    $set.status = nextStatus;

    if (nextStatus === "resolved") {
      $set.resolvedAt = now;
      $set.resolvedReason = "manual";
    } else if (nextStatus === "open") {
      // Reabertura manual. Histórico preservado em resolvedAt/resolvedReason.
      $set.reopenedAt = now;
    }
    // wont_fix e expired só alteram o status — sem timestamps adicionais.

    await recordUserEvent({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      observationId: observation._id,
      patternId: observation.patternId,
      type:
        nextStatus === "open"
          ? "reopened"
          : nextStatus === "resolved"
            ? "resolved"
            : nextStatus === "wont_fix"
              ? "wont_fix"
              : "expired",
      userId: actorId,
      displayName: actorName,
      reason: nextStatus === "open" ? "user-action" : "manual",
      metadata: {
        previousStatus: observation.status,
        newStatus: nextStatus,
      },
    });
  }

  // ---------- assignedTo ----------
  if (
    hasAssigneeField &&
    nextAssignee !== undefined &&
    nextAssignee !== (observation.assignedTo ?? null)
  ) {
    $set.assignedTo = nextAssignee ?? null;

    await recordUserEvent({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      observationId: observation._id,
      patternId: observation.patternId,
      type: "assigned",
      userId: actorId,
      displayName: actorName,
      metadata: {
        previousAssignee: observation.assignedTo ?? null,
        newAssignee: nextAssignee,
      },
    });
  }

  if (Object.keys($set).length > 0) {
    await Observation.updateOne({ _id: observation._id }, { $set });
  }

  const updated = await Observation.findById(observation._id).lean();

  return NextResponse.json(updated);
}
