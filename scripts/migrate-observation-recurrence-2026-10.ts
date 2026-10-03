// scripts/migrate-observation-recurrence-2026-10.ts
//
// Uso:
//   npx tsx --env-file=.env.development.local scripts/migrate-observation-recurrence-2026-10.ts --dry-run
//   npx tsx --env-file=.env.development.local scripts/migrate-observation-recurrence-2026-10.ts
//
// Objetivo: eliminar o status `recurring`, substituído por `open` +
// `reopenedAt` + `recurrenceCount`. Preserva histórico (resolvedAt e
// resolvedReason não são limpos).

import { connectToDatabase } from "../lib/mongodb";
import { Observation } from "../models/Observation";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  await connectToDatabase();
  console.log(`[migrate-recurrence] modo: ${dryRun ? "DRY-RUN" : "LIVE"}`);

  const coll = Observation.collection;
  const db = coll.conn.db;
  if (!db) throw new Error("DB não disponível");

  const pendingRecurring = await coll.countDocuments({ status: "recurring" });
  const pendingRecurrenceCount = await coll.countDocuments({
    recurrenceCount: { $exists: false },
  });

  console.log(
    `[migrate-recurrence] recurring → open: ${pendingRecurring} docs`,
  );
  console.log(
    `[migrate-recurrence] recurrenceCount ausente: ${pendingRecurrenceCount} docs`,
  );

  if (dryRun) {
    console.log(`\n[migrate-recurrence] [DRY] nada foi alterado`);
    process.exit(0);
  }

  // Backup automático
  const backupName = `observations_backup_${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}`;
  const allDocs = await coll.find({}).toArray();
  await db.collection(backupName).insertMany(allDocs);
  console.log(
    `[migrate-recurrence] backup: ${backupName} (${allDocs.length} docs)`,
  );

  // Passo 1 — garantir `recurrenceCount` em todos os documentos.
  // Sem isto, os `$inc` do passo 2 rodariam sobre campo ausente e o
  // resultado ficaria inconsistente entre docs migrados e nativos.
  const step1 = await coll.updateMany(
    { recurrenceCount: { $exists: false } },
    { $set: { recurrenceCount: 0 } },
  );
  console.log(
    `[migrate-recurrence] recurrenceCount:0 aplicado em ${step1.modifiedCount} docs`,
  );

  // Passo 2 — converter `recurring` em `open` preservando histórico.
  // `reopenedAt` usa `lastSeen` (momento da última detecção que gerou o
  // status recurring). `resolvedAt`/`resolvedReason` ficam intactos.
  const step2 = await coll.updateMany({ status: "recurring" }, [
    {
      $set: {
        status: "open",
        reopenedAt: { $ifNull: ["$lastSeen", "$resolvedAt", "$$NOW"] },
        recurrenceCount: {
          $add: [{ $ifNull: ["$recurrenceCount", 0] }, 1],
        },
      },
    },
  ]);
  console.log(
    `[migrate-recurrence] recurring → open: ${step2.modifiedCount} docs`,
  );

  const remaining = await coll.countDocuments({ status: "recurring" });
  console.log(`\n[migrate-recurrence] concluído`);
  console.log(`  recurring restantes: ${remaining}`);
  console.log(
    remaining > 0
      ? `  ⚠ ainda há documentos com status obsoleto`
      : `  ✓ nenhum documento com status 'recurring'`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate-recurrence] falha fatal:", err);
  process.exit(1);
});
