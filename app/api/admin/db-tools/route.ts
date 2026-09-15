import { type NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import * as Sentry from "@sentry/nextjs";
import { connectToDatabase } from "@/lib/mongodb";
import { getServerAuthSession } from "@/lib/auth-server";
import { toNonEmptyString } from "@/lib/validators";
import { dumpDatabase, restoreDatabase } from "@/lib/db-tools";
import { verifyKeycloakPassword } from "@/lib/keycloak-verify";
import { computeNextRun } from "@/lib/backup-schedule";
import { BackupSchedule } from "@/models/BackupSchedule";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ============================================================
// Constantes
// ============================================================
const DUMPS_ROOT = path.resolve(
  /* turbopackIgnore: true */ process.env.DB_DUMPS_DIR ?? 
  path.join(process.cwd(), "dumps"),
);
const MANIFEST_FILENAME = "manifest.json";
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const SOURCE_URIS: Record<string, string | undefined> = {
  primary: process.env.MONGODB_URI,
  atlas: process.env.ATLAS_URI,
};

class PathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathValidationError";
  }
}

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

// ============================================================
// Helpers de path
// ============================================================
function sanitizeDumpId(raw: string): string {
  const stripped = path.basename(raw);
  if (!SAFE_ID_PATTERN.test(stripped)) {
    throw new PathValidationError("Identificador inválido");
  }
  return stripped;
}

function manifestPathFor(dirPath: string): string {
  const candidate = path.join(dirPath, MANIFEST_FILENAME);
  if (!candidate.startsWith(dirPath + path.sep)) {
    throw new PathValidationError("Caminho do manifesto inválido");
  }
  return candidate;
}

async function getCanonicalRoot(): Promise<string> {
  await fs.mkdir(DUMPS_ROOT, { recursive: true });
  return fs.realpath(/* turbopackIgnore: true */ DUMPS_ROOT);
}

function resolveUri(sourceId: string): string {
  const uri = SOURCE_URIS[sourceId];
  if (!uri) {
    throw new PathValidationError(`Fonte "${sourceId}" não configurada`);
  }
  return uri;
}

// ============================================================
// Autorização
// ============================================================
async function requireAdmin() {
  const session = await getServerAuthSession();
  if (!session?.user) throw new AuthError("Unauthorized");
  if (!session.user.isAdmin) throw new AuthError("Forbidden");
  return session;
}

// ============================================================
// GET — lista dumps + schedule atual
// ============================================================
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Forbidden" ? 403 : 401 },
      );
    }
    throw error;
  }

  try {
    const root = await getCanonicalRoot();
    const entries = await fs.readdir(root, { withFileTypes: true });

    const safeIds = entries
      .filter((e) => e.isDirectory())
      .map((e) => path.basename(e.name))
      .filter((name) => SAFE_ID_PATTERN.test(name));

    const dumps = await Promise.all(
      safeIds.map(async (safeId) => {
        const dirPath = path.join(root, safeId);
        const real = await fs.realpath(dirPath);
        if (!real.startsWith(root + path.sep)) {
          return { id: safeId, path: dirPath, manifest: null };
        }
        const filePath = manifestPathFor(real);
        let manifest: unknown = null;
        try {
          const stat = await fs.lstat(filePath);
          if (stat.isFile()) {
            const raw = await fs.readFile(filePath, "utf8");
            manifest = JSON.parse(raw);
          }
        } catch {
          /* dump incompleto */
        }
        return { id: safeId, path: dirPath, manifest };
      }),
    );

    await connectToDatabase();
    const schedule = await BackupSchedule.findById("default").lean();

    return NextResponse.json({ dumps, schedule });
  } catch (error) {
    console.error("Erro ao listar dumps:", error);
    return NextResponse.json(
      { error: "Erro ao listar dumps" },
      { status: 500 },
    );
  }
}

// ============================================================
// POST — ações
// ============================================================
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Forbidden" ? 403 : 401 },
      );
    }
    throw error;
  }

  const session = await getServerAuthSession();
  const body = (await req.json()) as Record<string, unknown>;
  const action = toNonEmptyString(body.action);

  try {
    await connectToDatabase();
    const root = await getCanonicalRoot();

    // --------------------------------------------------------
    // DUMP
    // --------------------------------------------------------
    if (action === "dump") {
      const sourceId = toNonEmptyString(body.source) ?? "primary";
      const uri = resolveUri(sourceId);

      const rawLabel =
        toNonEmptyString(body.label) ??
        new Date().toISOString().replace(/[:.]/g, "-");
      const safeLabel = sanitizeDumpId(rawLabel);
      const outputDir = path.join(root, safeLabel);

      const manifest = await dumpDatabase({ uri, outputDir });

      return NextResponse.json({
        ok: true,
        id: safeLabel,
        source: sourceId,
        manifest,
      });
    }

    // --------------------------------------------------------
    // RESTORE — com backup de segurança e verificação de senha
    // --------------------------------------------------------
    if (action === "restore") {
      // 1. Verifica senha do admin
      const password = toNonEmptyString(body.password);
      const email = session?.user?.email ?? "";
      if (!password) {
        throw new AuthError("Senha obrigatória");
      }
      const ok = await verifyKeycloakPassword(email, password);
      if (!ok) throw new AuthError("Senha incorreta");

      // 2. Resolve dump e destino
      const rawId = toNonEmptyString(body.id);
      if (!rawId) {
        throw new PathValidationError("ID do dump é obrigatório");
      }
      const safeId = sanitizeDumpId(rawId);
      const candidateDir = path.join(root, safeId);
      const realDir = await fs.realpath(candidateDir);
      if (!realDir.startsWith(root + path.sep)) {
        throw new PathValidationError("Caminho fora do diretório permitido");
      }

      const manifestPath = manifestPathFor(realDir);
      const stat = await fs.lstat(manifestPath);
      if (!stat.isFile()) {
        throw new PathValidationError("Manifesto do dump inválido");
      }

      const targetId = toNonEmptyString(body.target) ?? "primary";
      const targetUri = resolveUri(targetId);

      // 3. Backup de segurança — salva o estado atual do destino antes de sobrescrever
      const rawSafetyLabel =
        toNonEmptyString(body.safetyBackupLabel) ??
        `pre-restore-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      const safetyLabel = sanitizeDumpId(rawSafetyLabel);
      const safetyDir = path.join(root, safetyLabel);

      const safetyManifest = await dumpDatabase({
        uri: targetUri,
        outputDir: safetyDir,
      });

      // 4. Restore
      try {
        const result = await restoreDatabase({
          uri: targetUri,
          inputDir: realDir,
          dropExisting: true,
        });

        return NextResponse.json({
          ok: true,
          ...result,
          source: safeId,
          target: targetId,
          safetyBackup: safetyLabel,
          safetyManifest,
        });
      } catch (restoreError) {
        // Backup de segurança fica intacto se o restore falhar
        Sentry.captureException(restoreError, {
          extra: {
            dump: safeId,
            target: targetId,
            safetyBackup: safetyLabel,
          },
        });
        throw restoreError;
      }
    }

    // --------------------------------------------------------
    // SCHEDULE — atualiza config do cron
    // --------------------------------------------------------
    if (action === "schedule") {
      const enabled = Boolean(body.enabled);
      const frequency = ["daily", "weekly", "monthly"].includes(
        String(body.frequency),
      )
        ? (body.frequency as "daily" | "weekly" | "monthly")
        : "daily";

      const hour = Math.max(0, Math.min(23, Number(body.hour ?? 3)));
      const minute = Math.max(0, Math.min(59, Number(body.minute ?? 0)));
      const dayOfWeek =
        typeof body.dayOfWeek === "number" ? body.dayOfWeek : undefined;
      const dayOfMonth =
        typeof body.dayOfMonth === "number" ? body.dayOfMonth : undefined;
      const source =
        body.source === "atlas" ? ("atlas" as const) : ("primary" as const);
      const retentionDays = Math.max(
        1,
        Math.min(365, Number(body.retentionDays ?? 30)),
      );

      const now = new Date();
      const nextRunAt = computeNextRun(
        { frequency, hour, minute, dayOfWeek, dayOfMonth },
        now,
      );

      const schedule = await BackupSchedule.findByIdAndUpdate(
        "default",
        {
          $set: {
            enabled,
            frequency,
            hour,
            minute,
            dayOfWeek,
            dayOfMonth,
            source,
            retentionDays,
            nextRunAt,
            updatedAt: now,
          },
        },
        { new: true, upsert: true },
      );

      return NextResponse.json({ ok: true, schedule });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    if (error instanceof PathValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AuthError) {
      const status = error.message === "Senha incorreta" ? 401 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("Erro em db-tools:", error);
    Sentry.captureException(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 },
    );
  }
}