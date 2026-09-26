// app/api/sast/profiles/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { ScanProfile } from "@/models/ScanProfile";
import { VulnerabilityPattern } from "@/models/VulnerabilityPattern";
import { User } from "@/models/User";
import { connectToDatabase } from "@/lib/mongodb";
import { requireSession } from "@/lib/api-auth";

/**
 * Lista os perfis de scan do usuário autenticado.
 *
 * @summary Lista perfis de scan do usuário
 * @tags Sast, Profiles
 * @route GET /api/sast/profiles
 * @async
 * @function GET
 * @returns {Promise<NextResponse>} Lista de perfis.
 */
export async function GET() {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  await connectToDatabase();

  const profiles = await ScanProfile.find({ sub: auth.user.sub })
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ profiles });
}

/**
 * Cria um novo perfil de scan.
 *
 * @summary Cria perfil de scan
 * @tags Sast, Profiles
 * @route POST /api/sast/profiles
 * @async
 * @function POST
 * @param {NextRequest} req - Corpo: `{ name, description?, patternIds: string[] }`.
 * @returns {Promise<NextResponse>} Perfil criado ou erro.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  await connectToDatabase();

  const dbUser = await User.findOne({ sub: auth.user.sub });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : undefined;
  const patternIds: unknown = body?.patternIds;

  if (!name || !Array.isArray(patternIds) || patternIds.length === 0) {
    return NextResponse.json(
      { error: "Nome e pelo menos um pattern são obrigatórios." },
      { status: 400 },
    );
  }

  const validPatterns = await VulnerabilityPattern.find({
    _id: { $in: patternIds },
    enabled: true,
  })
    .select({ _id: 1 })
    .lean();

  if (validPatterns.length !== patternIds.length) {
    return NextResponse.json(
      { error: "Um ou mais patterns são inválidos ou estão desabilitados." },
      { status: 400 },
    );
  }

  try {
    const profile = await ScanProfile.create({
      tenantId: auth.user.tenantId,
      userId: dbUser._id,
      sub: auth.user.sub,
      name,
      description,
      patternIds: validPatterns.map((p) => p._id),
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: "Já existe um perfil com esse nome." },
        { status: 409 },
      );
    }
    throw err;
  }
}
