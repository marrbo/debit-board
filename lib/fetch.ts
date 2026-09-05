// lib/fetch.ts
import * as Sentry from '@sentry/nextjs';

export const fetchNoStore = async (url: string, init?: RequestInit) => {
  fetch(url, { cache: 'no-store', ...init });
  Sentry.metrics.count(url, 1);
}
  