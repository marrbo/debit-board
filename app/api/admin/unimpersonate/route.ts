// app/api/admin/unimpersonate/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  // Remove o cookie de impersonação
  const cookieStore = await cookies();
  cookieStore.delete('impersonating_user');

  return NextResponse.json({ success: true });
}