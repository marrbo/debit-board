// app/api/observations/[id]/notes/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Observation } from "@/models/Observation";
import { ObservationEvent } from "@/models/ObservationEvent";
import { User } from "@/models/User";
import { requireSession } from "@/lib/api-auth";
import { toObjectId } from "@/lib/mongo-id";

/** Limite defensivo de tamanho da nota. */
const MAX_NOTE_LENGTH = 2000;

/**
 * Registra uma nota do usuário na timeline da observation.
 *
 * Notas são eventos (`type: "note"`) — não persistem em campo próprio.
 * A listagem vem por `/api/observations/{id}/events`.
 *
 * @summary Adiciona nota à timeline
 * @tags Observations, Notes
 * @route POST /api/observations/{id}/notes
 */
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;

  const observationId = toObjectId(id);
  if (!observationId) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantId = toObjectId(auth.user.tenantId);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant inválido." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const rawNote: unknown = body?.note;
  const note = typeof rawNote === "string" ? rawNote.trim() : "";

  if (!note) {
    return NextResponse.json({ error: "Nota vazia." }, { status: 400 });
  }
  if (note.length > MAX_NOTE_LENGTH) {
    return NextResponse.json(
      { error: `Nota excede ${MAX_NOTE_LENGTH} caracteres.` },
      { status: 400 },
    );
  }

  await connectToDatabase();

  // Confirma existência e isola por tenant — evita escrever evento
  // apontando para observation de outro tenant.
  const observation = await Observation.findOne({
    _id: observationId,
    tenantId,
  })
    .select({ _id: 1, patternId: 1 })
    .lean();

  if (!observation) {
    return NextResponse.json(
      { error: "Observation não encontrada." },
      { status: 404 },
    );
  }

  // Resolve usuário para actor completo (userId + displayName).
  const dbUser = await User.findOne({ sub: auth.user.sub })
    .select("_id name email")
    .lean();

  const event = await ObservationEvent.create({
    tenantId,
    type: "note",
    at: new Date(),
    actor: {
      type: "user",
      userId: dbUser?._id,
      displayName: dbUser?.name ?? dbUser?.email ?? auth.user.sub,
    },
    observationIds: [observation._id],
    patternId: observation.patternId,
    note,
  });

  return NextResponse.json(event.toObject(), { status: 201 });
}
