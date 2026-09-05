// app/api/users/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/models/User';
import { getServerSessionIds } from '@/lib/session-server';

export async function GET() {
  const { tenantId } = await getServerSessionIds();

  await connectToDatabase();
  const users = await User.find({ tenantId })
    .select('sub name email')
    .lean();

  return NextResponse.json(users);
}