import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { connectToDatabase } from "@/lib/mongodb";
import { dumpDatabase } from "@/lib/db-tools";
import { isDue, markRun } from "@/lib/backup-schedule";
import { BackupSchedule } from "@/models/BackupSchedule";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DUMPS_ROOT = path.resolve(
  /* turbopackIgnore: true */ process.env.DB_DUMPS_DIR ?? 
  path.join(process.cwd(), "dumps"),
);

const SOURCE_URIS: Record<string, string | undefined> = {
  primary: process.env.MONGDB_URI,
  atlas: process.env.ATLAS_URI,
};

/** Remove dumps mais antigos que `retentionDays`. */
async function pruneOldDumps(retentionDays: number): Promise<void> {
  const root = path.resolve(/* turbopackIgnore: true */ DUMPS_ROOT);
  const entries = await fs
    .readdir(/* turbopackIgnore: true */ root, { withFileTypes: true })
    .catch(() => []);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1_000;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // Só apaga backups automáticos — preserva os que o usuário nomeou
    if (!entry.name.startsWith("auto-")) continue;

    const dirPath = path.join(root, entry.name);
    const stat = await fs
      .stat(/* turbopackIgnore: true */ dirPath)
      .catch(() => null);
    if (stat && stat.mtimeMs < cutoff) {
      await fs.rm(dirPath, { recursive: true, force: true });
    }
  }
}

/**
 * Cria recurso do endpoint /api/cron/backup.
 *
 * Este endpoint expõe a operação post em /api/cron/backup.
 *
 * @summary Cria recurso do endpoint /api/cron/backup
 * @tags Cron, Backup
 * @route POST /api/cron/backup
 * @async
 * @function POST
 * @param {NextRequest} req - Requisição HTTP recebida pelo endpoint.
 * @returns {Promise<NextResponse>} Resposta JSON da operação executada.
 */
export async function POST(req: NextRequest) {
  // Autenticação via token compartilhado
  const expected = `Bearer ${process.env.CRON_TOKEN}`;
  if (req.headers.get("authorization") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const config = await BackupSchedule.findById("default").lean();
  if (!config) {
    return NextResponse.json({ ok: true, skipped: "no schedule" });
  }

  const now = new Date();
  if (!isDue(config, now)) {
    return NextResponse.json({ ok: true, skipped: "not due" });
  }

  const uri = SOURCE_URIS[config.source];
  if (!uri) {
    await markRun("failed", `Fonte "${config.source}" não configurada`);
    Sentry.captureMessage(`Backup cron: fonte ${config.source} não configurada`);
    return NextResponse.json({ ok: false, error: "source missing" }, { status: 500 });
  }

  const label = `auto-${config.source}-${now.toISOString().replace(/[:.]/g, "-")}`;
  const outputDir = path.join(DUMPS_ROOT, label);

  try {
    await fs.mkdir(DUMPS_ROOT, { recursive: true });
    const manifest = await dumpDatabase({ uri, outputDir });
    await markRun("success");
    await pruneOldDumps(config.retentionDays);

    return NextResponse.json({ ok: true, id: label, manifest });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    await markRun("failed", message);
    Sentry.captureException(error, {
      tags: { job: "backup-cron" },
      extra: { source: config.source, label },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}