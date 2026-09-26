// lib/dbql.ts
import mongoose from "mongoose";
import { SavedQuery } from "@/models/SavedQuery";

/**
 * Resolve o parâmetro `q` para uma string DBQL.
 *
 * Aceita tanto o `_id` de uma `SavedQuery` quanto um DBQL cru
 * (`severity:critical OR project:my-api`). Sem essa distinção, um
 * DBQL cru faria `SavedQuery.findById` lançar `CastError` e o filtro
 * cairia silenciosamente.
 *
 * @param raw - Valor do parâmetro `q` (id de SavedQuery OU DBQL cru).
 * @returns DBQL resolvido ou `null` quando nada aplicável.
 */
export async function resolveDbqlString(
  raw: string | null | undefined,
): Promise<string | null> {
  if (!raw) return null;
  if (!mongoose.Types.ObjectId.isValid(raw)) return raw;

  try {
    const savedQuery = await SavedQuery.findById(raw).lean();
    return savedQuery?.queryString ?? null;
  } catch (error) {
    console.error("Erro ao buscar SavedQuery:", error);
    return null;
  }
}
