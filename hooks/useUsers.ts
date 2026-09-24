"use client";

import { useEffect, useState } from "react";
import type { IUser } from "@/types/IUser";

// Cache em memória — evita refetch quando o componente remonta
let cachedUsers: IUser[] | null = null;
let inflight: Promise<IUser[]> | null = null;

async function loadUsers(): Promise<IUser[]> {
  if (cachedUsers) return cachedUsers;
  if (inflight) return inflight;

  inflight = fetch("/api/users")
    .then((r) => (r.ok ? r.json() : []))
    .then((data: IUser[]) => {
      cachedUsers = data;
      inflight = null;
      return data;
    })
    .catch(() => {
      inflight = null;
      return [] as IUser[];
    });

  return inflight;
}

export function useUsers() {
  const [users, setUsers] = useState<IUser[]>(cachedUsers ?? []);
  const [loaded, setLoaded] = useState(cachedUsers !== null);

  useEffect(() => {
    let cancelled = false;
    loadUsers().then((list) => {
      if (cancelled) return;
      setUsers(list);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { users, loaded };
}