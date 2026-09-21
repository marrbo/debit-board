// app/api/sast/scans/route.ts
import { type NextRequest } from "next/server";
import { SASTScan } from "@/models/SASTScan";
import { handleGenericGet } from "@/lib/api-handler";
import { connectToDatabase } from "@/lib/mongodb";
import { requireSession } from "@/lib/api-auth";

/**
 * Lista recursos do endpoint /api/sast/scans.
 *
 * Este endpoint expõe a operação get em /api/sast/scans.
 *
 * @summary Lista recursos do endpoint /api/sast/scans
 * @tags Sast, Scans
 * @route GET /api/sast/scans
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (auth.ok === false) return auth.response;

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const isAll = searchParams.get("all") === "true";
  const searchQueryRaw =
    searchParams.get("search") || searchParams.get("q") || "";

  return handleGenericGet(req, {
    model: SASTScan,
    defaultSort: "scanDate",
    overrideSearchQuery: searchQueryRaw,
    all: isAll,
    projection: {
      _id: 1,
      scanDate: 1,
      status: 1,
      totalOccurrences: 1,
      patternCount: 1,
      failedPatterns: 1,
    },
  });
}
