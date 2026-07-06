import { useEffect, useState } from 'react';
import { apiGet } from '../api/client';
import type { Team } from '../api/types';

export function useTeams() {
  const [teamsById, setTeamsById] = useState<Map<string, Team>>(new Map());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<Team[]>('/teams').then((teams) => {
      if (cancelled) return;
      setTeamsById(new Map(teams.map((t) => [t.id, t])));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const teamName = (id: string) => teamsById.get(id)?.name ?? 'Equipo';
  const teamMembers = (id: string) => teamsById.get(id)?.members ?? [];
  const teamLogo = (id: string) => teamsById.get(id)?.logo;

  return { teamName, teamMembers, teamLogo, loaded };
}
