//lib/util.ts
import type { IAzureSettings } from '@/types/IAzureSettings';
import type { SearchItem } from './types';
import { useSession } from 'next-auth/react';
import type mongoose from 'mongoose';

export const isContainer = (process.env.RUNNING_IN_CONTAINER ?? false) === 'true' ;
export const isLocalHost = process.env.NODE_ENV === 'development' && !isContainer;

export function getMongoUri() {
  return isLocalHost ? process.env.MONGODB_URI_LOCAL : process.env.MONGODB_URI
}

export function getNextAuthUrl() {
  return isLocalHost ? process.env.NEXTAUTH_URL_LOCAL : process.env.NEXTAUTH_URL
}

export function useClientSessionIds(): {
  userId: string;
  tenantId: mongoose.Types.ObjectId;
  azureSettings?: IAzureSettings;
} {
  const { data: session } = useSession();

  return {
    userId: session?.user?.id || '',
    tenantId: session?.user?.tenantId,
    azureSettings: session?.user?.azureSettings,
  };
}

export function parseRepoName(repo: string): { gerencia: string; nucleo: string } {
  if (!repo) return { gerencia: 'Sem Gerência', nucleo: 'Sem Núcleo' };
  const parts = repo.split('_');
  // Só retorna Gerência/Núcleo se houver pelo menos 2 partes.
  // Se não houver underline, NÃO vira Gerência. Vai para "Sem Gerência".
  if (parts.length >= 2) {
    return { gerencia: parts[0] || '', nucleo: parts.slice(1).join('_') };
  }
  return { gerencia: 'Sem Gerência', nucleo: 'Sem Núcleo' };
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const keyStr = String(key);
    const groupKey = typeof item[key] === 'object' ? `Sem ${keyStr}` : String(item[key]);
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function calculateTotalHits(items: SearchItem[]): number {
  return items.reduce((sum, item) => sum + (item.hitCount || 0), 0);
}