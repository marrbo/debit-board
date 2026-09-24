// hooks/useResolvedTheme.ts
"use client";

import { useSyncExternalStore } from "react";
import { useLocalSetting } from "@/hooks/useLocalSettings";

const MEDIA_QUERY = "(prefers-color-scheme: dark)";

const subscribeMedia = (cb: () => void) => {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(MEDIA_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

const getMediaSnapshot = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia(MEDIA_QUERY).matches;

const getMediaServerSnapshot = (): boolean => false;

export function useResolvedTheme(): "light" | "dark" {
  const [theme] = useLocalSetting("theme");
  const systemDark = useSyncExternalStore(
    subscribeMedia,
    getMediaSnapshot,
    getMediaServerSnapshot,
  );

  return theme === "system"
    ? systemDark
      ? "dark"
      : "light"
    : theme;
}