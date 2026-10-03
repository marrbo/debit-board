// scripts/merge-duplicate-observations.ts
//
// Uso:
//   npx tsx --env-file=.env.development.local scripts/merge-duplicate-observations.ts --dry-run
//   npx tsx --env-file=.env.development.local scripts/merge-duplicate-observations.ts
//
// Estratégia: para cada grupo de duplicatas, mantém a observation com
// status mais "ativo" (open > recurring > resolved > wont_fix > expired)
// e mais recente em caso de empate. Marca as demais como `resolved`
// com `resolvedReason: "duplicate-merged"`.

import { connectToDatabase } from "../lib/mongodb";
import { Observation } from "../models/Observation";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  await connectToDatabase();
  console.log(`[merge-duplicates] modo: ${dryRun ? "DRY-RUN" : "LIVE"}`);

  const coll = Observation.collection;
  const db = coll.conn.db;
  if (!db) throw new Error("DB não disponível");

  const groups = await coll
    .aggregate([
      { $match: { patternId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: {
            tenantId: "$tenantId",
            patternId: "$patternId",
            project: { $ifNull: ["$project", ""] },
            repository: { $ifNull: ["$repository", ""] },
            filePath: "$filePath",
          },
          docs: {
            $push: {
              _id: "$_id",
              status: "$status",
              firstSeen: "$firstSeen",
              lastSeen: "$lastSeen",
            },
          },
        },
      },
      { $match: { "docs.1": { $exists: true } } },
    ])
    .toArray();

  console.log(`[merge-duplicates] ${groups.length} grupos encontrados`);

  if (dryRun) {
    groups.forEach((g) => {
      console.log(`\nChave: ${JSON.stringify(g._id)}`);
      g.docs.forEach((d: any) =>
        console.log(`  ${d._id} [${d.status}] lastSeen=${d.lastSeen}`),
      );
    });
    console.log(
      `\n[merge-duplicates] [DRY] ${groups.length} grupos seriam mesclados`,
    );
    process.exit(0);
  }

  // Backup automático
  const backupName = `observations_backup_${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}`;
  const allDocs = await coll.find({}).toArray();
  await db.collection(backupName).insertMany(allDocs);
  console.log(
    `[merge-duplicates] backup: ${backupName} (${allDocs.length} docs)`,
  );

  let merged = 0;

  for (const group of groups) {
    const ACTIVE = new Set(["open", "recurring"]);

    const sorted = [...group.docs].sort((a: any, b: any) => {
      const aActive = ACTIVE.has(a.status) ? 0 : 1;
      const bActive = ACTIVE.has(b.status) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive; // ativo antes de inativo
      return new Date(a.firstSeen).getTime() - new Date(b.firstSeen).getTime(); // mais antigo vence
    });

    const survivor = sorted[0];
    const losers = sorted.slice(1);

    await coll.updateMany(
      { _id: { $in: losers.map((l: any) => l._id) } },
      {
        $set: {
          status: "resolved",
          resolvedAt: new Date(),
          resolvedReason: "duplicate-merged",
        },
      },
    );

    merged += losers.length;
    console.log(
      `  ✓ sobrevivente ${survivor._id} [${survivor.status}] | ${losers.length} duplicata(s) resolvida(s)`,
    );

    const summary = {
      groups: groups.length,
      recurring_survives: 0,
      open_survives: 0,
      resolved_survives: 0,
      total_losers: 0,
    };
    groups.forEach((g) => {
      const sorted = [...g.docs].sort(/* mesma regra acima */);
      const s = sorted[0];
      if (s.status === "recurring") summary.recurring_survives++;
      else if (s.status === "open") summary.open_survives++;
      else if (s.status === "resolved") summary.resolved_survives++;
      summary.total_losers += sorted.length - 1;
    });
    console.log("[merge-duplicates] resumo:", summary);
  }

  console.log("\n[merge-duplicates] concluído:");
  console.log(`  grupos   : ${groups.length}`);
  console.log(`  resolvidas: ${merged}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("[merge-duplicates] falha fatal:", err);
  process.exit(1);
});
