//app/stats/page.tsx
import { Suspense } from "react";
import { getStats } from "./services/statsService";
import StatsClient from "./StatsClient";
import LoadingSkeleton from "@/components/LoadingSkeleton";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const stats = await getStats();

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <StatsClient initialStats={stats} />
    </Suspense>
  );
}
