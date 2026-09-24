// app/api/users/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/models/User';
import { getServerSessionIds } from '@/lib/session-server';

/**
 * Lista recursos do endpoint /api/users.
 *
 * Este endpoint expõe a operação get em /api/users.
 *
 * @summary Lista recursos do endpoint /api/users
 * @tags Users
 * @route GET /api/users
 * @async
 * @function GET
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function GET() {
  const { tenantId } = await getServerSessionIds();

  await connectToDatabase();
  const users = await User.find({ tenantId })
    .select('sub name email')
    .lean();

  return NextResponse.json(users);
}