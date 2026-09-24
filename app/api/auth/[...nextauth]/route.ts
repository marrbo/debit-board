import { authOptions } from "@/lib/auth-options";
import NextAuth from "next-auth";

/**
 * Lista recursos do endpoint /api/auth/{nextauth}.
 *
 * Este endpoint expõe a operação get em /api/auth/{nextauth}.
 *
 * @summary Lista recursos do endpoint /api/auth/{nextauth}
 * @tags Auth, Nextauth
 * @route GET /api/auth/{nextauth}
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function GET(req: Request, context: any) {
  const handler = NextAuth(authOptions);
  return handler(req, context);
}

/**
 * Cria recurso do endpoint /api/auth/{nextauth}.
 *
 * Este endpoint expõe a operação post em /api/auth/{nextauth}.
 *
 * @summary Cria recurso do endpoint /api/auth/{nextauth}
 * @tags Auth, Nextauth
 * @route POST /api/auth/{nextauth}
 * @async
 * @function POST
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function POST(req: Request, context: any) {
  const handler = NextAuth(authOptions);
  return handler(req, context);
}