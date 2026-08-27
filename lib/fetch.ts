// lib/fetch.ts
export const fetchNoStore = (url: string, init?: RequestInit) =>
  fetch(url, { cache: 'no-store', ...init });