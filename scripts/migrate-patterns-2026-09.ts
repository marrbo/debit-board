// scripts/migrate-patterns-2026-09.ts
//
// Uso:
//   npx tsx --env-file=.env.development.local scripts/migrate-patterns-2026-09.ts --dry-run
//   npx tsx --env-file=.env.development.local scripts/migrate-patterns-2026-09.ts
//
// Idempotente. Pula patterns cujo dbId já está aplicado.

import { connectToDatabase } from "../lib/mongodb";
import { VulnerabilityPattern } from "../models/VulnerabilityPattern";
import fs from "fs/promises";
import path from "path";

interface MigrationEntry {
  _id: { $oid: string };
  dbId: string;
  dbName: string;
  score: number;
  slaHours: number;
  reference: string;
  description: string;
  recommendation: string;
  deprecated?: boolean;
  deprecatedReason?: string;
  deprecatedAt?: { $date: string };
  supersededBy?: { $oid: string };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const jsonPath =
    process.argv.find((a) => a.endsWith(".json")) ??
    path.resolve("scripts/data/patterns-migration-2026-09.json");

  await connectToDatabase();
  console.log(`[migrate] modo: ${dryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(`[migrate] arquivo: ${jsonPath}`);

  const raw = await fs.readFile(jsonPath, "utf-8");
  const migration = JSON.parse(raw) as MigrationEntry[];

  console.log(`[migrate] ${migration.length} entries a processar`);

  // ============================================================
  // Backup automático da collection
  // ============================================================
  const backupName = `vulnerabilitypatterns_backup_${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}`;

  const coll = VulnerabilityPattern.collection;
  const db = coll.conn.db;
  if (!db) throw new Error("DB não disponível");

  const docs = await coll.find({}).toArray();
  if (!dryRun) {
    await db.collection(backupName).insertMany(docs);
    console.log(`[migrate] backup: ${backupName} (${docs.length} docs)`);
  } else {
    console.log(`[migrate] [DRY] backup seria: ${backupName}`);
  }

  // ============================================================
  // Aplica migração
  // ============================================================
  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  const errors: string[] = [];

  for (const entry of migration) {
    const oid = entry._id.$oid;

    const existing = await VulnerabilityPattern.findById(oid).lean();
    if (!existing) {
      console.warn(`  ✗ ${oid} — não encontrado`);
      notFound++;
      continue;
    }

    // Idempotência: dbId já aplicado → pula
    if (existing.dbId === entry.dbId && existing.dbName === entry.dbName) {
      skipped++;
      continue;
    }

    const $set: Record<string, unknown> = {
      dbId: entry.dbId,
      dbName: entry.dbName,
      score: entry.score,
      slaHours: entry.slaHours,
      reference: entry.reference,
      description: entry.description,
      recommendation: entry.recommendation,
    };

    if (entry.deprecated) {
      $set.deprecated = true;
      $set.enabled = false;
      $set.deprecatedAt = entry.deprecatedAt
        ? new Date(entry.deprecatedAt.$date)
        : new Date();
      if (entry.deprecatedReason) {
        $set.deprecatedReason = entry.deprecatedReason;
      }
      if (entry.supersededBy) {
        $set.supersededBy = entry.supersededBy.$oid;
      }
    }

    // Campos legados removidos
    const $unset: Record<string, ""> = {
      scoreOWASP: "",
      scoreCVE: "",
    };

    if (dryRun) {
      console.log(`  → [DRY] ${oid} → ${entry.dbId}`);
      updated++;
      continue;
    }

    try {
      await coll.updateOne({ _id: existing._id }, { $set, $unset });
      console.log(`  ✓ ${oid} → ${entry.dbId}`);
      updated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${oid}: ${msg}`);
      errors.push(`${oid}: ${msg}`);
    }
  }

  console.log("\n[migrate] concluído:");
  console.log(`  atualizados : ${updated}`);
  console.log(`  pulados     : ${skipped}`);
  console.log(`  ausentes    : ${notFound}`);
  console.log(`  erros       : ${errors.length}`);
  if (errors.length > 0) {
    console.log("\nErros:");
    errors.forEach((e) => console.log(`  - ${e}`));
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate] falha fatal:", err);
  process.exit(1);
});
