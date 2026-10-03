// scripts/fix-orphan-scan-results.ts
//
// Uso:
//   npx tsx --env-file=.env.development.local scripts/fix-orphan-scan-results.ts --dry-run
//   npx tsx --env-file=.env.development.local scripts/fix-orphan-scan-results.ts
//
// Para cada SASTScanResult cujo scanId não existe em SASTScan:
//   - Se há observations referenciando esse scanId → recria o SASTScan
//     com dados derivados (tenantId + firstSeen da observation, counts
//     do result).
//   - Se não há → deleta o result órfão.
//
// Backup automático antes de qualquer alteração. Modo dry-run por
// padrão; requer --apply para executar.

import { connectToDatabase } from "../lib/mongodb";
import mongoose from "mongoose";
import { SASTScan } from "../models/SASTScan";
import { SASTScanResult } from "../models/SASTScanResult";
import { Observation } from "../models/Observation";

interface Plan {
  resultId: string;
  scanId: string;
  patternCount: number;
  totalResults: number;
  obsCount: number;
  action: "delete" | "recreate";
  tenantId?: string;
  firstSeen?: Date;
}

async function main() {
  const dryRun = !process.argv.includes("--apply");

  await connectToDatabase();
  console.log(
    `[fix-orphan-results] modo: ${dryRun ? "DRY-RUN (use --apply para executar)" : "LIVE"}`,
  );

  // 1. Descobrir órfãos
  const scanIds = new Set(
    (await SASTScan.find().select("_id").lean()).map((s) => String(s._id)),
  );
  const results = await SASTScanResult.find().lean();
  const orphans = results.filter((r) => !scanIds.has(String(r.scanId)));

  console.log(`[fix-orphan-results] ${results.length} results no banco`);
  console.log(`[fix-orphan-results] ${orphans.length} órfãos detectados`);

  if (orphans.length === 0) {
    console.log("[fix-orphan-results] nada a fazer.");
    process.exit(0);
  }

  // 2. Planejar
  const plans: Plan[] = [];

  for (const r of orphans) {
    const scanId = String(r.scanId);
    let totalResults = 0;
    for (const p of r.patterns || []) {
      totalResults += (p.results || []).length;
    }
    const obsCount = await Observation.countDocuments({ scanId: r.scanId });

    const plan: Plan = {
      resultId: String(r._id),
      scanId,
      patternCount: (r.patterns || []).length,
      totalResults,
      obsCount,
      action: obsCount > 0 ? "recreate" : "delete",
    };

    if (obsCount > 0) {
      const sample = await Observation.findOne({ scanId: r.scanId })
        .select("tenantId firstSeen")
        .lean();
      if (sample) {
        plan.tenantId = String(sample.tenantId);
        plan.firstSeen = sample.firstSeen;
      }
    }

    plans.push(plan);
  }

  // 3. Relatório
  console.log("");
  console.log("[fix-orphan-results] plano:");
  for (const p of plans) {
    const summary =
      `  scanId=${p.scanId} | patterns=${p.patternCount} ` +
      `results=${p.totalResults} obs=${p.obsCount} → ${p.action.toUpperCase()}`;
    console.log(summary);
    if (p.action === "recreate" && p.tenantId) {
      console.log(
        `    tenantId=${p.tenantId} firstSeen=${p.firstSeen?.toISOString()}`,
      );
    }
  }

  const deletes = plans.filter((p) => p.action === "delete").length;
  const recreates = plans.filter((p) => p.action === "recreate").length;
  console.log("");
  console.log(
    `[fix-orphan-results] resumo: ${deletes} deletes, ${recreates} recreates`,
  );

  if (dryRun) {
    process.exit(0);
  }

  // 4. Backup
  const db = SASTScanResult.collection.conn.db;
  if (!db) throw new Error("DB indisponível");

  const backupName = `orphan_results_backup_${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}`;
  await db.collection(backupName).insertMany(orphans);
  console.log(`[fix-orphan-results] backup: ${backupName}`);

  // 5. Executar
  let deleted = 0;
  let recreated = 0;

  for (const p of plans) {
    if (p.action === "delete") {
      await SASTScanResult.deleteOne({ _id: p.resultId });
      deleted++;
      console.log(`  ✗ result deletado: ${p.resultId}`);
    } else {
      const tenantId = new mongoose.Types.ObjectId(p.tenantId!);
      const scanDate = p.firstSeen ?? new Date();

      await SASTScan.create({
        _id: new mongoose.Types.ObjectId(p.scanId),
        tenantId,
        origin: "azure-search-code",
        scanDate,
        completedAt: scanDate,
        status: "completed",
        patternCount: p.patternCount,
        totalOccurrences: p.totalResults,
        failedPatterns: 0,
        summary: [],
      });
      recreated++;
      console.log(
        `  ✓ scan recriado: ${p.scanId} (${p.obsCount} observations referenciam)`,
      );
    }
  }

  console.log("");
  console.log("[fix-orphan-results] concluído.");
  console.log(`  results deletados: ${deleted}`);
  console.log(`  scans recriados:   ${recreated}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("[fix-orphan-results] falha fatal:", err);
  process.exit(1);
});
