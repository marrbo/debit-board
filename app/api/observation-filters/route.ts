// app/api/observation-filters/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Observation } from "@/models/Observation";
import type { PipelineStage } from "mongoose";
import { User } from "@/models/User";
import { requireSession } from "@/lib/api-auth";

// Mapeamento de aliases para campos reais
const FIELD_MAP: Record<string, string> = {
  category: "category",
  branch: "branch",
  status: "status",
  assigned: "assignedTo", // alias para assignedTo
  project: "project",
  repository: "repository",
};

/**
 * Lista recursos do endpoint /api/observation-filters.
 *
 * Este endpoint expõe a operação get em /api/observation-filters.
 *
 * @summary Lista recursos do endpoint /api/observation-filters
 * @tags Observation Filters
 * @route GET /api/observation-filters
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  const tenantId = auth.user.tenantId;
  const { searchParams } = new URL(req.url);
  const fieldRaw = searchParams.get("field");
  const query = searchParams.get("query") || "";

  if (!fieldRaw) {
    return NextResponse.json({ suggestions: [] });
  }

  // Resolve o campo real a partir do alias
  const field = FIELD_MAP[fieldRaw] || fieldRaw;

  await connectToDatabase();

  // Caso especial: assignedTo -> retornar nomes de usuários
  if (field === "assignedTo") {
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: "i" }, tenantId },
        { email: { $regex: query, $options: "i" }, tenantId },
      ],
    })
      .limit(10)
      .select("name email sub")
      .lean();

    const suggestions = users.map((u: any) => u.name || u.email);
    return NextResponse.json({ suggestions });
  }

  // Para outros campos, usa aggregate (pipeline original)
  const pipeline: PipelineStage[] = [
    { $match: { tenantId } },
    { $group: { _id: `$${field}` } },
    {
      $match: {
        _id: {
          $ne: null,
          $regex: query,
          $options: "i",
        },
      },
    },
    { $project: { value: "$_id" } },
    { $sort: { value: 1 } },
    { $limit: 15 },
  ];

  const results = await Observation.aggregate(pipeline);
  const suggestions = results.map((r) => r.value);

  return NextResponse.json({ suggestions });
}
