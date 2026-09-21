import { type NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

/**
 * Consome o token de impersonação, seta o cookie e redireciona.
 * Este endpoint é chamado apenas pela janela nova.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== "impersonation") throw new Error("Invalid token");

    const isProd = process.env.NODE_ENV === "production";
    const res = NextResponse.redirect(new URL("/stats", req.url));

    res.cookies.set("impersonating_user", String(payload.sub), {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 60 * 15,
      path: "/",
    });
    res.cookies.set("impersonating_admin_id", String(payload.impersonatedBy), {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 60 * 15,
      path: "/",
    });
    // Marca essa aba como a "janela de impersonação"
    res.cookies.set("impersonation_window", "1", {
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      maxAge: 60 * 15,
      path: "/",
    });

    return res;
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
