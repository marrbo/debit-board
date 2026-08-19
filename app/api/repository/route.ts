// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Repository } from '@/models/Repository';
import { getServerAuthSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();

  await connectToDatabase();
  const repositorys = await Repository.find({ tenantId: session?.user.tenantId }).sort({ name: 1 }).lean();

  return NextResponse.json(repositorys);
}