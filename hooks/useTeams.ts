// hooks/useTeams.ts
"use client";

import { useEffect, useState } from "react";
import { useTeam } from "@/hooks/useLocalSettings";
import { getTeam } from "@/lib/local-settings";
import type { TeamOption } from "@/components/TeamSelector";

export function useTeams() {
  const [, setTeamId] = useTeam();
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/teams")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const list: TeamOption[] = json.data || [];
        setTeams(list);

        if (!getTeam() && list.length > 0) {
          const global = list.find((t) => t.isGlobal);
          const others = list.filter((t) => !t.isGlobal);
          const fallback =
            others.length === 1 ? others[0]._id : global?._id || list[0]._id;
          setTeamId(fallback);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setTeams([]);
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
    // setTeamId agora é referencialmente estável → effect roda 1×
  }, [setTeamId]);

  return { teams, loaded };
}