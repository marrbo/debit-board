// scripts/purge-scan-2026-09-25.ts
//
// Uso:
//   npx tsx --env-file=.env.development.local scripts/purge-scan-2026-09-25.ts --dry-run
//   npx tsx --env-file=.env.development.local scripts/purge-scan-2026-09-25.ts
//
// Objetivo: remover fisicamente o scan de 25/09 (21:11 UTC) que gerou
// 1141 observations duplicadas de scans anteriores. Sem rastro de
// `duplicate-merged` — delete físico.
//
// Segurança: verifica cada observation do scan alvo. Se QUALQUER uma
// não tiver contraparte em outro scan (órfã real), o script aborta sem
// alterar nada. Nunca deleta dado único.

import { connectToDatabase } from "../lib/mongodb";
import { Observation } from "../models/Observation";
import { SASTScan } from "../models/SASTScan";
import { SASTScanResult } from "@/models/SASTScanResult";
import mongoose from "mongoose";

const TARGET_SCAN_ID = "6ab6e39c9398ee46e58681c6";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  await connectToDatabase();
  console.log(`[purge-25-09] modo: ${dryRun ? "DRY-RUN" : "LIVE"}`);

  const obsColl = Observation.collection;
  const db = obsColl.conn.db;
  if (!db) throw new Error("DB não disponível");

  const targetId = new mongoose.Types.ObjectId(TARGET_SCAN_ID);

  const scan = await SASTScan.findById(targetId).lean();
  if (!scan) {
    console.error(`[purge-25-09] scan ${TARGET_SCAN_ID} não encontrado.`);
    process.exit(1);
  }

  console.log(
    `[purge-25-09] scan alvo: ${scan._id} | ${scan.scanDate.toISOString()} | totalOccurrences=${scan.totalOccurrences}`,
  );

  // Buscar todas as observations do scan alvo
  const targetObs = await obsColl.find({ scanId: targetId }).toArray();
  console.log(`[purge-25-09] observations do scan: ${targetObs.length}`);

  // Para cada uma, procurar contraparte em outro scan
  let withCounterpart = 0;
  const orphans: any[] = [];

  for (const o of targetObs) {
    const counterpart = await obsColl.findOne({
      _id: { $ne: o._id },
      scanId: { $ne: targetId },
      patternId: o.patternId,
      project: o.project ?? "",
      repository: o.repository ?? "",
      filePath: o.filePath,
    });
    if (counterpart) withCounterpart++;
    else orphans.push(o);
  }

  const summary = {
    targetObservations: targetObs.length,
    withCounterpart,
    orphans: orphans.length,
  };
  console.log("[purge-25-09] verificação:", summary);

  // Abortar se houver órfãs — segurança contra delete de dado único
  if (orphans.length > 0) {
    console.error(
      `\n[purge-25-09] ABORTADO: ${orphans.length} observation(s) do scan não têm contraparte em outro scan.`,
    );
    console.error("  Deletar o scan apagaria dado único.");
    console.error("  Amostra de órfãs:");
    orphans
      .slice(0, 5)
      .forEach((o) => console.error(`    - ${o.filePath} [${o.status}]`));
    process.exit(2);
  }

  if (dryRun) {
    console.log(
      `\n[purge-25-09] [DRY] ${targetObs.length} observations + 1 scan + 1 result seriam removidos`,
    );
    process.exit(0);
  }

  // Backup automático
  const backupName = `purge_25_09_${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}`;
  const snapshots = {
    observations: targetObs,
    sastscans: [scan],
    sastscanresults: await db
      .collection("sastscanresults")
      .find({ scanId: targetId })
      .toArray(),
  };
  for (const [name, docs] of Object.entries(snapshots)) {
    if (docs.length > 0) {
      await db.collection(`${backupName}__${name}`).insertMany(docs);
    }
  }
  console.log(
    `[purge-25-09] backup: ${backupName}__{observations,sastscans,sastscanresults}`,
  );

  // 1. Deletar observations
  const delObs = await obsColl.deleteMany({ scanId: targetId });
  console.log(`[purge-25-09] observations removidas: ${delObs.deletedCount}`);

  // 2. Deletar SASTScanResult
  const delResult = await SASTScanResult.deleteMany({ scanId: targetId });
  console.log(
    `[purge-25-09] sastscanresults removidos: ${delResult.deletedCount}`,
  );

  // 3. Deletar SASTScan
  await SASTScan.deleteOne({ _id: targetId });
  console.log(`[purge-25-09] scan removido: ${targetId}`);

  const remaining = await obsColl.countDocuments();
  console.log(
    `\n[purge-25-09] concluído. Observations restantes: ${remaining}`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("[purge-25-09] falha fatal:", err);
  process.exit(1);
});
