// app/api/observations/route.ts
import { type NextRequest, NextResponse } from "next/server";
import type { Types } from "mongoose";
import { handleGenericGet } from "@/lib/api-handler";
import { connectToDatabase } from "@/lib/mongodb";
import { Observation } from "@/models/Observation";
import { ObservationEvent } from "@/models/ObservationEvent";
import { User } from "@/models/User";
import { VulnerabilityPattern } from "@/models/VulnerabilityPattern";
import { buildObservationFilters } from "@/lib/observation-filters";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";
import type { IObservation } from "@/types/IObservation";
import type { IVulnerabilityPattern } from "@/types/IVulnerabilityPattern";

/**
 * Lista observations respeitando DBQL, time e janela temporal.
 *
 * Aceita `range=7d|14d|30d|90d|all` (preset) **ou** `from` + `to` (ISO,
 * custom). Quando ambos vêm preenchidos, `from`/`to` têm precedência.
 *
 * Usa `buildObservationFilters` como fonte única de verdade — os mesmos
 * filtros são aplicados em `/api/dashboard` e `/api/dashboard/stats`,
 * então as contagens nas três telas batem para o mesmo conjunto de
 * parâmetros.
 *
 * @summary Lista observations
 * @tags Observations
 * @route GET /api/observations
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP.
 * @returns {Promise<NextResponse>} `{ data, total, page, limit, totalPages }`.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantId = toObjectId(auth.user.tenantId);

  const { searchParams } = new URL(req.url);
  const dbqlId = searchParams.get("q");
  const teamId = searchParams.get("teamId");
  const range = searchParams.get("range");
  const rangeFrom = searchParams.get("from");
  const rangeTo = searchParams.get("to");
  const isAll = searchParams.get("all") === "true";

  const { match } = await buildObservationFilters({
    tenantId,
    dbqlId,
    teamId,
    range,
    rangeFrom,
    rangeTo,
  });

  try {
    const result = await handleGenericGet(req, {
      model: Observation,
      defaultSort: "firstSeen",
      additionalMatch: match,
      skipDbqlParsing: true,
      projection: {
        _id: 1,
        fileName: 1,
        filePath: 1,
        category: 1,
        patternId: 1,
        branch: 1,
        severity: 1,
        status: 1,
        slaDueAt: 1,
        assignedTo: 1,
        hitCount: 1,
        project: 1,
        repository: 1,
        firstSeen: 1,
        lastSeen: 1,
      },
      all: isAll,
    });

    const responseData = await result.json();
    const observations: IObservation[] = Array.isArray(responseData)
      ? responseData
      : responseData.data || [];

    if (observations.length > 0) {
      const patternIds = observations
        .map((o) => o.patternId)
        .filter((id): id is NonNullable<typeof id> => id != null);

      if (patternIds.length > 0) {
        const patterns = await VulnerabilityPattern.find({
          _id: { $in: patternIds },
        })
          .select(
            "_id name description recommendation score severity category externalId externalLink",
          )
          .lean();

        const patternMap = new Map(
          patterns.map((p: IVulnerabilityPattern) => [p._id.toString(), p]),
        );

        observations.forEach((obs) => {
          const pattern = patternMap.get(obs.patternId?.toString());
          if (pattern) {
            obs.patternName = pattern.name;
            obs.description = pattern.description;
            obs.recommendation = pattern.recommendation;
            obs.pattern = pattern;
          } else {
            obs.patternName = "";
            obs.description = "";
            obs.recommendation = "";
            obs.pattern = null;
          }
        });
      } else {
        observations.forEach((obs) => {
          obs.patternName = "";
          obs.description = "";
          obs.recommendation = "";
        });
      }
    }

    if (Array.isArray(responseData)) {
      return NextResponse.json({
        data: observations,
        total: observations.length,
      });
    }
    return NextResponse.json({ ...responseData, data: observations });
  } catch (error) {
    console.error("Erro ao buscar observations:", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar observations" },
      { status: 500 },
    );
  }
}

/**
 * Atribuição em lote de responsável.
 *
 * Body: `{ observationIds: string[], assignedTo: string | null }`
 *
 * Grava 1 evento `assigned` por observation (cada uma tem sua própria
 * timeline) — bulk insert numa única chamada.
 *
 * @summary Atribui responsável em lote
 * @tags Observations
 * @route PATCH /api/observations
 * @async
 * @function PATCH
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantId = toObjectId(auth.user.tenantId);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant inválido." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  const rawIds: unknown = body?.observationIds;
  const rawIdList = Array.isArray(rawIds)
    ? rawIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      )
    : [];
  if (rawIdList.length === 0) {
    return NextResponse.json(
      { error: "`observationIds` deve ser uma lista não vazia." },
      { status: 400 },
    );
  }

  if (!Object.prototype.hasOwnProperty.call(body, "assignedTo")) {
    return NextResponse.json(
      { error: "Campo `assignedTo` ausente." },
      { status: 400 },
    );
  }
  const rawAssignee: unknown = body.assignedTo;
  const nextAssignee: string | null =
    rawAssignee === null
      ? null
      : typeof rawAssignee === "string"
        ? rawAssignee
        : (undefined as unknown as string);
  if (nextAssignee === undefined) {
    return NextResponse.json(
      { error: "`assignedTo` deve ser string ou null." },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const objectIds: Types.ObjectId[] = [];
  for (const id of rawIdList) {
    const oid = toObjectId(id);
    if (oid) objectIds.push(oid);
  }
  if (objectIds.length === 0) {
    return NextResponse.json({ error: "Nenhum ID válido." }, { status: 400 });
  }

  const observations = await Observation.find({
    _id: { $in: objectIds },
    tenantId,
  })
    .select("_id patternId assignedTo")
    .lean();

  if (observations.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma observation encontrada para os IDs informados." },
      { status: 404 },
    );
  }

  const dbUser = await User.findOne({ sub: auth.user.sub })
    .select("_id name email")
    .lean();
  const actorName = dbUser?.name ?? dbUser?.email ?? auth.user.sub;
  const actorId = dbUser?._id;

  const now = new Date();
  const changed = observations.filter(
    (o) => (o.assignedTo ?? null) !== nextAssignee,
  );

  if (changed.length > 0) {
    await Observation.updateMany(
      { _id: { $in: changed.map((o) => o._id) } },
      { $set: { assignedTo: nextAssignee } },
    );

    // Uma timeline por observation — eventos individuais, bulk insert.
    await ObservationEvent.insertMany(
      changed.map((o) => ({
        tenantId,
        type: "assigned" as const,
        at: now,
        actor: {
          type: "user" as const,
          userId: actorId,
          displayName: actorName,
        },
        observationIds: [o._id],
        patternId: o.patternId,
        metadata: {
          previousAssignee: o.assignedTo ?? null,
          newAssignee: nextAssignee,
        },
      })),
    );
  }

  return NextResponse.json({
    updated: changed.length,
    unchanged: observations.length - changed.length,
  });
}
