// scripts/migrate-sast-scans-2026-09.ts
//
// Uso:
//   npx tsx --env-file=.env.development.local scripts/migrate-sast-scans-2026-09.ts --dry-run
//   npx tsx --env-file=.env.development.local scripts/migrate-sast-scans-2026-09.ts
//
// Idempotente: pula scans que já têm scanId preenchido.

import { connectToDatabase } from "../lib/mongodb";
import { SASTScan } from "../models/SASTScan";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  await connectToDatabase();
  console.log(`[migrate-scans] modo: ${dryRun ? "DRY-RUN" : "LIVE"}`);

  const coll = SASTScan.collection;
  const db = coll.conn.db;
  if (!db) throw new Error("DB não disponível");

  const docs = await coll.find({}).toArray();
  if (!dryRun) {
    const backupName = `sastscans_backup_${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}`;
    await db.collection(backupName).insertMany(docs);
    console.log(`[migrate-scans] backup: ${backupName} (${docs.length} docs)`);
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const scan of docs) {
    // Idempotência: se já tem scanId, pula
    if (scan.scanId) {
      skipped++;
      continue;
    }

    const date = scan.scanDate ? new Date(scan.scanDate) : new Date();
    const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "");
    const suffix = String(scan._id).slice(-6).toUpperCase();
    const scanId = `SCAN-${yyyymmdd}-${suffix}`;

    const durationMs =
      scan.completedAt && scan.scanDate
        ? new Date(scan.completedAt).getTime() -
          new Date(scan.scanDate).getTime()
        : null;

    const $set: Record<string, unknown> = {
      scanId,
      origin: scan.origin ?? "azure-search-code",
      profileId: scan.profileId ?? null,
      profileName: scan.profileName ?? null,
      rerunOfScanId: scan.rerunOfScanId ?? null,
    };
    if (durationMs !== null) $set.durationMs = durationMs;

    if (dryRun) {
      console.log(`  → [DRY] ${scan._id} → ${scanId}`);
      updated++;
      continue;
    }

    try {
      await coll.updateOne({ _id: scan._id }, { $set });
      console.log(`  ✓ ${scan._id} → ${scanId}`);
      updated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${scan._id}: ${msg}`);
      errors++;
    }
  }

  console.log("\n[migrate-scans] concluído:");
  console.log(`  atualizados : ${updated}`);
  console.log(`  pulados     : ${skipped}`);
  console.log(`  erros       : ${errors}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate-scans] falha fatal:", err);
  process.exit(1);
});
