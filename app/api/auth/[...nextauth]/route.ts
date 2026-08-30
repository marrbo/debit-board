// app/api/auth/[...nextauth]/route.ts
import { getAuthOptions } from "@/lib/auth";
import NextAuth from "next-auth";

export async function GET(req: Request, context: any) {
  const authOptions = await getAuthOptions();
  const handler = NextAuth(authOptions);
  return handler(req, /* @next-codemod-error 'context' is passed as an argument. Any asynchronous properties of 'props' must be awaited when accessed. */
  context);
}

export async function POST(req: Request, context: any) {
  const authOptions = await getAuthOptions();
  const handler = NextAuth(authOptions);
  return handler(req, /* @next-codemod-error 'context' is passed as an argument. Any asynchronous properties of 'props' must be awaited when accessed. */
  context);
}