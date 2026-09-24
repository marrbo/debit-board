import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Encerra a impersonação removendo os cookies.
 * Não exige requireAdmin(), pois quando impersonado o role é do usuário alvo.
 */
export async function POST() {
  const cookieStore = await cookies();

  cookieStore.delete("impersonating_user");
  cookieStore.delete("impersonating_admin_id");
  cookieStore.delete("impersonation_window");

  return NextResponse.json({ success: true });
}
