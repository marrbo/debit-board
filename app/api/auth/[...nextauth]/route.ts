import { authOptions } from "@/lib/auth-options";
import NextAuth from "next-auth";

export async function GET(req: Request, context: any) {
  const handler = NextAuth(authOptions);
  return handler(req, context);
}

export async function POST(req: Request, context: any) {
  const handler = NextAuth(authOptions);
  return handler(req, context);
}