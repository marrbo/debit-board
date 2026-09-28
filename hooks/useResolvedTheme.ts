// hooks/useResolvedTheme.ts
"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLocalSetting } from "@/hooks/useLocalSettings";
import { writeThemeCookie } from "@/lib/theme-cookie";

const MEDIA_QUERY = "(prefers-color-scheme: dark)";

const subscribeMedia = (cb: () => void) => {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(MEDIA_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

const getMediaSnapshot = (): boolean =>
  typeof window !== "undefined" && window.matchMedia(MEDIA_QUERY).matches;

const getMediaServerSnapshot = (): boolean => false;

export function useResolvedTheme(): "light" | "dark" {
  const [theme] = useLocalSetting("theme");
  const systemDark = useSyncExternalStore(
    subscribeMedia,
    getMediaSnapshot,
    getMediaServerSnapshot,
  );

  const resolved: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // Espelha o tema resolvido no cookie lido pelo Keycloak.
  // Dispara em: troca manual no toggle OU mudança do SO enquanto
  // `theme === "system"`. Não dispara em re-renders com mesmo valor.
  useEffect(() => {
    writeThemeCookie(resolved);
  }, [resolved]);

  return resolved;
}
