import { BackupSchedule, type IBackupSchedule } from "@/models/BackupSchedule";

/**
 * Calcula a próxima execução depois de `from` conforme a config.
 * Retorna Date em UTC — o servidor decide o fuso (padrão: UTC).
 */
export function computeNextRun(
  config: Pick<
    IBackupSchedule,
    "frequency" | "hour" | "minute" | "dayOfWeek" | "dayOfMonth"
  >,
  from: Date = new Date(),
): Date {
  const next = new Date(from);
  next.setUTCSeconds(0, 0);
  next.setUTCHours(config.hour, config.minute, 0, 0);

  if (next <= from) next.setUTCDate(next.getUTCDate() + 1);

  switch (config.frequency) {
    case "daily":
      return next;

    case "weekly": {
      const target = config.dayOfWeek ?? 1; // segunda-feira
      while (next.getUTCDay() !== target) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      return next;
    }

    case "monthly": {
      const target = config.dayOfMonth ?? 1;
      next.setUTCDate(1);
      next.setUTCMonth(next.getUTCMonth() + 1);
      next.setUTCDate(target);
      return next;
    }
  }
}

/** Retorna true se `now` bate com o minuto agendado (tolerância 1 min). */
export function isDue(
  config: IBackupSchedule,
  now: Date = new Date(),
): boolean {
  if (!config.enabled) return false;

  if (config.hour !== now.getUTCHours()) return false;
  if (config.minute !== now.getUTCMinutes()) return false;

  if (config.frequency === "weekly") {
    if (config.dayOfWeek !== now.getUTCDay()) return false;
  }
  if (config.frequency === "monthly") {
    if (config.dayOfMonth !== now.getUTCDate()) return false;
  }

  // Evita execução dupla dentro do mesmo minuto
  if (config.lastRunAt) {
    const elapsed = now.getTime() - config.lastRunAt.getTime();
    if (elapsed < 60_000) return false;
  }
  return true;
}

/** Marca início/fim de uma execução. */
export async function markRun(
  status: "success" | "failed",
  error?: string,
): Promise<void> {
  const now = new Date();
  const config = await BackupSchedule.findById("default").lean();
  if (!config) return;

  await BackupSchedule.findByIdAndUpdate("default", {
    $set: {
      lastRunAt: now,
      lastRunStatus: status,
      lastRunError: error,
      nextRunAt: computeNextRun(config, now),
      updatedAt: now,
    },
  });
}