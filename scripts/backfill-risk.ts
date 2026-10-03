// scripts/backfill-risk.ts
//
// Uso:
//   pnpm tsx scripts/backfill-risk.ts
//   ou: npx tsx scripts/backfill-risk.ts
//
// Idempotente. Pula scans que já têm riskScore > 0.
// Passe --force para recalcular todos.

import { connectToDatabase } from "../lib/mongodb";
import { SASTScan } from "../models/SASTScan";
import { SASTScanResult } from "../models/SASTScanResult";
import {
  aggregateRisk,
  type RiskFinding,
  type RiskSeverity,
} from "../lib/risk";

interface SearchItemLike {
  hitCount?: number;
}

async function main() {
  const force = process.argv.includes("--force");

  await connectToDatabase();
  console.log(`[backfill-risk] modo: ${force ? "force" : "incremental"}`);

  const filter = force
    ? {}
    : { $or: [{ riskScore: { $exists: false } }, { riskScore: 0 }] };

  const scans = await SASTScan.find(filter)
    .select({ _id: 1, tenantId: 1, scanDate: 1 })
    .lean();

  console.log(`[backfill-risk] ${scans.length} scans a processar`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const scan of scans) {
    try {
      const result = await SASTScanResult.findOne({ scanId: scan._id }).lean();
      if (!result) {
        skipped += 1;
        continue;
      }

      const findings: RiskFinding[] = [];
      for (const p of result.patterns) {
        // Cada item em `results` é uma ocorrência (arquivo/linha)
        const items = (p.results ?? []) as SearchItemLike[];
        if (items.length === 0) continue;
        for (const item of items) {
          findings.push({
            severity: p.severity as RiskSeverity,
            // O scan original não distingue status por finding; tratamos
            // como `open` (mesma semântica do /run).
            status: "open",
            hitCount: item.hitCount ?? 0,
          });
        }
      }

      const risk = aggregateRisk(findings);

      await SASTScan.updateOne(
        { _id: scan._id },
        { $set: { riskScore: risk.score, riskBand: risk.band } },
      );

      console.log(
        `  ✓ ${scan._id} → ${risk.score} (${risk.band}) · ${findings.length} findings`,
      );
      processed += 1;
    } catch (err) {
      console.error(`  ✗ ${scan._id}:`, (err as Error).message);
      errors += 1;
    }
  }

  console.log("\n[backfill-risk] concluído");
  console.log(`  processados: ${processed}`);
  console.log(`  pulados    : ${skipped}`);
  console.log(`  erros      : ${errors}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill-risk] falha fatal:", err);
  process.exit(1);
});
