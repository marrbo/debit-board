// scripts/backfill-observation-events.ts
//
// Uso:
//   npx tsx --env-file=.env.development.local scripts/backfill-observation-events.ts --dry-run
//   npx tsx --env-file=.env.development.local scripts/backfill-observation-events.ts
//
// Reconstrói a timeline (`ObservationEvent`) a partir dos dados existentes:
//   1. SASTScan        — ordem cronológica via `scanDate`
//   2. SASTScanResult  — quais arquivos cada scan tocou, agrupados por pattern
//   3. Observation     — conjunto canônico de observations a reconstruir
//
// Estratégia: para cada observation, caminha pelos scans em ordem
// cronológica e detecta transições de presença (ausente ↔ presente).
// Cada transição vira um evento. O agrupamento final é por
// `(scanId, patternId, type, reason)` — mesmo padrão do
// `recordScanEvents`, mantendo o feed legível (Aikido-style).
//
// Limitações:
//   - Não reconstrói `assigned`, `wont_fix`, `expired` ou `note`
//     (ações de usuário, não deriváveis de scans).
//   - Se existir evento prévio, o script aborta para não duplicar.
//     Para rodar de novo: `db.observationevents.deleteMany({})`.
//   - Algoritmo O(obs × scans) com lookup O(1) via `Set.has`.

import { connectToDatabase } from "../lib/mongodb";
import { SASTScan } from "../models/SASTScan";
import { SASTScanResult } from "../models/SASTScanResult";
import { Observation } from "../models/Observation";
import { ObservationEvent } from "../models/ObservationEvent";
import { VulnerabilityPattern } from "../models/VulnerabilityPattern";

const FILE_SAMPLE_LIMIT = 5;
const BATCH_SIZE = 500;

type EventType = "detected" | "reopened" | "resolved";

interface CanonicalKey {
  patternId: string;
  project: string;
  repository: string;
  filePath: string;
}

function makeCanonicalKey(k: CanonicalKey): string {
  return `${k.patternId}|${k.project}|${k.repository}|${k.filePath}`;
}

function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

interface GroupedEvent {
  tenantId: string;
  type: EventType;
  at: Date;
  scanId?: string;
  scanDisplayName?: string;
  patternId: string;
  patternName?: string;
  observationIds: string[];
  files: string[];
  reason?: string;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  await connectToDatabase();
  console.log(`[backfill-events] modo: ${dryRun ? "DRY-RUN" : "LIVE"}`);

  // Guard: aborta se já existirem eventos
  const existing = await ObservationEvent.countDocuments();
  if (existing > 0) {
    console.error(
      `[backfill-events] ${existing} eventos já existem — abortando.`,
    );
    console.error("  Para rodar de novo: db.observationevents.deleteMany({})");
    process.exit(1);
  }

  // 1. Scans em ordem cronológica
  const scans = await SASTScan.find()
    .sort({ scanDate: 1 })
    .select("_id scanId scanDate")
    .lean();
  console.log(`[backfill-events] ${scans.length} scans`);
  if (scans.length === 0) {
    console.error("[backfill-events] sem scans — nada a fazer.");
    process.exit(0);
  }

  // 2. SASTScanResults
  const results = await SASTScanResult.find().select("scanId patterns").lean();
  console.log(`[backfill-events] ${results.length} SASTScanResults`);

  // 3. Presença por scan — Map<scanId, Set<canonicalKey>>
  const scanPresence = new Map<string, Set<string>>();
  for (const r of results) {
    const set = new Set<string>();
    for (const p of r.patterns) {
      if (p.error) continue;
      const patternIdStr = String(p.patternId);
      for (const item of p.results || []) {
        set.add(
          makeCanonicalKey({
            patternId: patternIdStr,
            project: item.project || "",
            repository: item.repository || "",
            filePath: item.path,
          }),
        );
      }
    }
    scanPresence.set(String(r.scanId), set);
  }

  // 4. Padrões para nome desnormalizado (lookup único)
  const patternIds = new Set<string>();
  for (const set of scanPresence.values()) {
    for (const key of set) {
      patternIds.add(key.split("|")[0]);
    }
  }
  const patterns = await VulnerabilityPattern.find({
    _id: { $in: Array.from(patternIds) },
  })
    .select("_id name")
    .lean();
  const patternNameById = new Map(patterns.map((p) => [String(p._id), p.name]));
  console.log(
    `[backfill-events] ${patternNameById.size} patterns únicos resolvidos`,
  );

  // 5. Observations
  const observations = await Observation.find()
    .select("_id tenantId patternId project repository filePath firstSeen")
    .lean();
  console.log(`[backfill-events] ${observations.length} observations`);

  // 6. Reconstruir timeline por observation e agrupar
  const grouped = new Map<string, GroupedEvent>();

  const emit = (
    key: string,
    event: Omit<GroupedEvent, "observationIds" | "files">,
    obsId: string,
    filePath: string,
  ) => {
    const entry =
      grouped.get(key) ??
      ({ ...event, observationIds: [], files: [] } as GroupedEvent);
    entry.observationIds.push(obsId);
    if (entry.files.length < FILE_SAMPLE_LIMIT && filePath) {
      entry.files.push(filePath);
    }
    grouped.set(key, entry);
  };

  let observationsWithoutScanData = 0;
  let observationsSkipped = 0;

  for (const obs of observations) {
    if (!obs.patternId) {
      observationsSkipped++;
      continue;
    }

    const obsKey = makeCanonicalKey({
      patternId: String(obs.patternId),
      project: obs.project || "",
      repository: obs.repository || "",
      filePath: obs.filePath,
    });
    const patternName = patternNameById.get(String(obs.patternId));

    let wasPresent = false;
    let hasEverBeenDetected = false;
    let resolutionCount = 0;
    let producedAnyEvent = false;

    for (const scan of scans) {
      const presence = scanPresence.get(String(scan._id));
      if (!presence) continue;

      const isPresent = presence.has(obsKey);

      if (isPresent && !wasPresent) {
        const type: EventType = hasEverBeenDetected ? "reopened" : "detected";
        emit(
          `${scan._id}|${obs.patternId}|${type}`,
          {
            tenantId: String(obs.tenantId),
            type,
            at: scan.scanDate,
            scanId: String(scan._id),
            scanDisplayName: scan.scanId ?? shortId(String(scan._id)),
            patternId: String(obs.patternId),
            patternName,
            reason: type === "reopened" ? "regression" : undefined,
          },
          String(obs._id),
          obs.filePath,
        );
        hasEverBeenDetected = true;
        producedAnyEvent = true;
      } else if (!isPresent && wasPresent) {
        resolutionCount++;
        const reason =
          resolutionCount === 1 ? "scan-not-found" : "auto-resolved";
        emit(
          `${scan._id}|${obs.patternId}|resolved|${reason}`,
          {
            tenantId: String(obs.tenantId),
            type: "resolved",
            at: scan.scanDate,
            scanId: String(scan._id),
            scanDisplayName: scan.scanId ?? shortId(String(scan._id)),
            patternId: String(obs.patternId),
            patternName,
            reason,
          },
          String(obs._id),
          obs.filePath,
        );
        producedAnyEvent = true;
      }

      wasPresent = isPresent;
    }

    // Fallback: observation sem rastro em nenhum scan — usa firstSeen
    // como marco inicial, sem referência a scan.
    if (!producedAnyEvent) {
      observationsWithoutScanData++;
      emit(
        `orphan|${obs.patternId}|detected`,
        {
          tenantId: String(obs.tenantId),
          type: "detected",
          at: obs.firstSeen,
          patternId: String(obs.patternId),
          patternName,
        },
        String(obs._id),
        obs.filePath,
      );
    }
  }

  // 7. Resumo + amostra
  console.log("");
  console.log("[backfill-events] resumo:");
  console.log(`  observations processadas:     ${observations.length}`);
  console.log(`  observations sem dados scan:  ${observationsWithoutScanData}`);
  console.log(`  observations sem patternId:   ${observationsSkipped}`);
  console.log(`  eventos gerados:              ${grouped.size}`);

  const byType = new Map<EventType, number>();
  for (const e of grouped.values()) {
    byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
  }
  console.log("  por tipo:");
  for (const [type, n] of byType) {
    console.log(`    ${type.padEnd(9)}: ${n}`);
  }

  if (dryRun) {
    console.log("\n[backfill-events] amostra (5 eventos):");
    let i = 0;
    for (const [, e] of grouped) {
      if (i++ >= 5) break;
      console.log(
        `  ${e.type.padEnd(9)} ${e.at.toISOString().slice(0, 10)} ` +
          `obs=${String(e.observationIds.length).padStart(4)} ` +
          `pattern=${(e.patternName ?? e.patternId).slice(0, 30).padEnd(30)} ` +
          `scan=${(e.scanDisplayName ?? "—").padEnd(12)} ` +
          `reason=${e.reason ?? "—"}`,
      );
    }
    console.log(
      `\n[backfill-events] [DRY] ${grouped.size} eventos seriam criados`,
    );
    process.exit(0);
  }

  // 8. Marker + inserção em lotes
  const markerName = `observationevents_backfill_${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}`;
  const db = ObservationEvent.collection.conn.db;
  if (db) {
    await db.collection(markerName).insertOne({
      _meta: "backfill marker",
      at: new Date(),
      eventCount: grouped.size,
    });
  }
  console.log(`[backfill-events] marker: ${markerName}`);

  const docs = Array.from(grouped.values()).map((e) => ({
    tenantId: e.tenantId,
    type: e.type,
    at: e.at,
    actor: e.scanId
      ? {
          type: "scan" as const,
          scanId: e.scanId,
          displayName: e.scanDisplayName,
        }
      : { type: "system" as const },
    observationIds: e.observationIds,
    patternId: e.patternId,
    patternName: e.patternName,
    reason: e.reason,
    metadata: {
      observationCount: e.observationIds.length,
      files: e.files,
    },
  }));

  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const r = await ObservationEvent.insertMany(batch, { ordered: false });
    inserted += r.length;
    console.log(
      `[backfill-events] lote ${Math.floor(i / BATCH_SIZE) + 1}: ${r.length} eventos`,
    );
  }

  console.log(`\n[backfill-events] concluído. ${inserted} eventos criados.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill-events] falha fatal:", err);
  process.exit(1);
});
