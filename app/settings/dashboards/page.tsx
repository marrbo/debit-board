// app/settings/dashboards/page.tsx
"use client";

import { Suspense } from "react";
import DashboardsClient from "./DashboardsClient";

export default function DashboardsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-muted">
          Carregando painéis salvos...
        </div>
      }
    >
      <DashboardsClient />
    </Suspense>
  );
}
