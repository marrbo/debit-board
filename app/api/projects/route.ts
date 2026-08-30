// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Project } from '@/models/Project';

export async function GET(req: NextRequest) {
  const tenantId = req.headers.get('x-tenant-id');

  await connectToDatabase();
  const projects = await Project.find({ tenantId: tenantId }).sort({ name: 1 }).lean();

  return NextResponse.json(projects);
}