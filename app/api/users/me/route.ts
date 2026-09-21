// app/api/users/me/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { requireSession } from "@/lib/api-auth";

/**
 * Lista recursos do endpoint /api/users/me.
 *
 * Este endpoint expõe a operação get em /api/users/me.
 *
 * @summary Lista recursos do endpoint /api/users/me
 * @tags Users, Me
 * @route GET /api/users/me
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function GET() {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  await connectToDatabase();
  const user = await User.findOne({ $eq: { sub: auth.user.sub } }).lean();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

/**
 * Atualiza parcialmente recurso do endpoint /api/users/me.
 *
 * Este endpoint expõe a operação patch em /api/users/me.
 *
 * @summary Atualiza parcialmente recurso do endpoint /api/users/me
 * @tags Users, Me
 * @route PATCH /api/users/me
 * @async
 * @function PATCH
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const body = await req.json();

  const { name, company, jobTitle, phone } = body;

  await connectToDatabase();
  await User.updateOne(
    { sub: auth.user.sub },
    { $set: { name, company, jobTitle, phone } },
  );

  return NextResponse.json({ success: true });
}
