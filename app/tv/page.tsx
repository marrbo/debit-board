// app/tv/page.tsx
"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import TVClient from "./TVClient";

/**
 * Modo TV — dashboard fullscreen com auto-refresh configurável.
 *
 * Fontes de configuração, em ordem de precedência:
 *  1. `?profile=<id>` — carrega um perfil salvo (`kind === "tv"`), do
 *     qual vêm `layout`, `refreshSec`, `teamId` e `cycleTeams`.
 *  2. Query params diretos: `teamId`, `q`, `range`, `refresh`, `cycle`.
 *
 * URL: `/tv?profile=…` ou `/tv?teamId=…&refresh=60&cycle=1`
 */
export default function TVPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-[9999] bg-page flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
        </div>
      }
    >
      <TVClient />
    </Suspense>
  );
}
