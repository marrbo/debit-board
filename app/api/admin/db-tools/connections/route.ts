import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth-server";
import { getServerInfo } from "@/lib/db-tools";

export const dynamic = "force-dynamic";

const SOURCES = [
  { id: "primary", label: "Servidor atual", envVar: "MONGODB_URI" },
  { id: "atlas", label: "Atlas (cloud)", envVar: "ATLAS_URI" },
] as const;

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const connections = await Promise.all(
    SOURCES.map(async (src) => {
      const uri = process.env[src.envVar];
      if (!uri) return { ...src, info: null, error: `${src.envVar} não configurada` };

      try {
        const info = await getServerInfo(uri);
        return { ...src, info };
      } catch (error) {
        return {
          ...src,
          info: null,
          error: error instanceof Error ? error.message : "Erro de conexão",
        };
      }
    }),
  );

  return NextResponse.json({ connections });
}