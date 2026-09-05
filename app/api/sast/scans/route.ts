// app/api/sast/scans/route.ts
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { SASTScan } from '@/models/SASTScan';

export async function GET(req: NextRequest) {
  const tenantId = req.headers.get('x-tenant-id');

  await connectToDatabase();
  const scans = await SASTScan.find({ tenantId: tenantId })
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json(scans);
}