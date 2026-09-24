import { type NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { requireAdmin } from "@/lib/api-auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

/**
 * Gera um token de impersonação (JWT, 15min) para o usuário alvo.
 * O frontend abre uma nova janela consumindo esse token.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.ok === false) return auth.response;

  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  await connectToDatabase();
  const targetUser = await User.findOne({ sub: userId }).lean();
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const token = await new SignJWT({
    sub: targetUser.sub,
    impersonatedBy: auth.user?.sub ?? auth.user?._id,
    type: "impersonation",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);

  return NextResponse.json({
    success: true,
    url: `/api/admin/impersonate/consume?token=${token}`,
  });
}
