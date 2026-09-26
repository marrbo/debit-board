// app/api/sast/patterns/route.ts
import { NextResponse } from "next/server";
import { VulnerabilityPattern } from "@/models/VulnerabilityPattern";
import { connectToDatabase } from "@/lib/mongodb";
import { requireSession } from "@/lib/api-auth";

/**
 * Lista os patterns SAST ativos disponíveis para seleção no modal de perfil.
 *
 * @summary Lista patterns SAST ativos
 * @tags Sast, Patterns
 * @route GET /api/sast/patterns
 * @async
 * @function GET
 * @returns {Promise<NextResponse>} Lista de patterns ativos (id, nome, categoria, severidade).
 */
export async function GET() {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  await connectToDatabase();

  const patterns = await VulnerabilityPattern.find({ enabled: true })
    .select({ _id: 1, name: 1, category: 1, severity: 1 })
    .sort({ category: 1, name: 1 })
    .lean();

  return NextResponse.json({ patterns });
}
