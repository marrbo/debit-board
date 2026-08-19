// app/api/auth/[...nextauth]/route.ts
import { getAuthOptions } from "@/lib/auth";
import NextAuth from "next-auth";

export async function GET(req: Request, context: any) {
  const authOptions = await getAuthOptions();
  const handler = NextAuth(authOptions);
  return handler(req, context);
}

export async function POST(req: Request, context: any) {
  const authOptions = await getAuthOptions();
  const handler = NextAuth(authOptions);
  return handler(req, context);
}