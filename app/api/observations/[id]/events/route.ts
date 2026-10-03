// app/api/observations/[id]/events/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ObservationEvent } from "@/models/ObservationEvent";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Lista eventos (timeline/lifecycle) de uma observation, paginados por
 * cursor `before`. Retorna os eventos mais recentes primeiro.
 *
 * @summary Timeline de uma observation
 * @tags Observations, Events
 * @route GET /api/observations/{id}/events
 */
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;

  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantId = toObjectId(auth.user.tenantId);
  const observationId = toObjectId(id);
  if (!observationId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const rawLimit = Number(searchParams.get("limit"));
  const limit = Math.min(Math.max(rawLimit || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const before = searchParams.get("before");

  const filter: Record<string, unknown> = {
    tenantId,
    observationIds: observationId,
  };
  if (before) {
    const beforeDate = new Date(before);
    if (!isNaN(beforeDate.getTime())) filter.at = { $lt: beforeDate };
  }

  const events = await ObservationEvent.find(filter)
    .sort({ at: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = events.length > limit;
  const sliced = hasMore ? events.slice(0, limit) : events;
  const nextBefore = hasMore
    ? sliced[sliced.length - 1].at.toISOString()
    : null;

  return NextResponse.json({ events: sliced, nextBefore });
}
