/**
 * Valida que `value` é uma string pertencente a `allowed`.
 * Retorna `null` quando o valor é de outro tipo ou está fora do conjunto —
 * bloqueia injeção de operador (`{ $ne: null }`) e valores inválidos.
 */
export function toStringEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  if (typeof value !== "string") return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Retorna `value` se for string não-vazia; senão `null`. */
export function toNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}