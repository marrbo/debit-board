import NextAuth from "next-auth";
import { getAuthOptions } from "@/lib/auth";

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