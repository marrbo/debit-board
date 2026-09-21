// app/api/admin/patterns/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { VulnerabilityPattern } from "@/models/VulnerabilityPattern";
import { requireAdmin } from "@/lib/api-auth";

/**
 * Lista recursos do endpoint /api/admin/patterns.
 *
 * Este endpoint expõe a operação get em /api/admin/patterns.
 *
 * @summary Lista recursos do endpoint /api/admin/patterns
 * @tags Admin, Patterns
 * @route GET /api/admin/patterns
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @access admin
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth.ok === false) return auth.response;

  await connectToDatabase();
  const patterns = await VulnerabilityPattern.find({}).sort({ name: 1 }).lean();
  return NextResponse.json(patterns);
}

/**
 * Cria recurso do endpoint /api/admin/patterns.
 *
 * Este endpoint expõe a operação post em /api/admin/patterns.
 *
 * @summary Cria recurso do endpoint /api/admin/patterns
 * @tags Admin, Patterns
 * @route POST /api/admin/patterns
 * @async
 * @function POST
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @access admin
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.ok === false) return auth.response;

  const body = await req.json();
  await connectToDatabase();
  const newPattern = new VulnerabilityPattern(body);
  await newPattern.save();
  return NextResponse.json(newPattern);
}

/**
 * Atualiza recurso do endpoint /api/admin/patterns.
 *
 * Este endpoint expõe a operação put em /api/admin/patterns.
 *
 * @summary Atualiza recurso do endpoint /api/admin/patterns
 * @tags Admin, Patterns
 * @route PUT /api/admin/patterns
 * @async
 * @function PUT
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @access admin
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const body = await req.json();
  await connectToDatabase();
  const updated = await VulnerabilityPattern.findByIdAndUpdate(id, body, {
    new: true,
  });
  return NextResponse.json(updated);
}

/**
 * Remove patterns.
 *
 * Este endpoint expõe a operação delete em /api/admin/patterns.
 *
 * @summary Remove patterns
 * @tags Admin, Patterns
 * @route DELETE /api/admin/patterns
 * @async
 * @function DELETE
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @access admin
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.ok === false) return auth.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  await connectToDatabase();
  await VulnerabilityPattern.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
