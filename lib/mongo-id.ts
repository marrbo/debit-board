import mongoose from "mongoose";

/**
 * Converte um valor arbitrário em `Types.ObjectId`.
 * Retorna `null` para qualquer entrada que não seja string válida ou
 * ObjectId — bloqueia injeção de operadores Mongo (`{ $ne: null }`,
 * `{ $gt: '' }`, etc.) porque nunca repassa o objeto adiante.
 */
export function toObjectId(value: unknown): mongoose.Types.ObjectId | null {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
}

/**
 * Converte lista heterogênea (array ou CSV) em ObjectIds válidos,
 * descartando silenciosamente os inválidos.
 */
export function toObjectIds(value: unknown): mongoose.Types.ObjectId[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return raw
    .map((item) => toObjectId(typeof item === "string" ? item.trim() : item))
    .filter((id): id is mongoose.Types.ObjectId => id !== null);
}