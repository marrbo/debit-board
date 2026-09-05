// app/api/admin/patterns/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { VulnerabilityPattern } from '@/models/VulnerabilityPattern';
import { getServerAuthSession } from '@/lib/auth-server';

export async function GET() {
  const session = await getServerAuthSession();
  if (session?.user?.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await connectToDatabase();
  const patterns = await VulnerabilityPattern.find({}).sort({ name: 1 }).lean();
  return NextResponse.json(patterns);
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (session?.user?.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  await connectToDatabase();
  const newPattern = new VulnerabilityPattern(body);
  await newPattern.save();
  return NextResponse.json(newPattern);
}

export async function PUT(req: NextRequest) {
  const session = await getServerAuthSession();
  if (session?.user?.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const body = await req.json();
  await connectToDatabase();
  const updated = await VulnerabilityPattern.findByIdAndUpdate(id, body, { new: true });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerAuthSession();
  if (session?.user?.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  await connectToDatabase();
  await VulnerabilityPattern.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}