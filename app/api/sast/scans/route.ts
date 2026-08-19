// app/api/sast/scans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { SASTScan } from '@/models/SASTScan';
import { getServerAuthSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await connectToDatabase();
  const scans = await SASTScan.find({ tenantId: session.user.tenantId })
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json(scans);
}