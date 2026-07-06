import { useEffect, useState } from 'react';
import { apiGet } from '../api/client';
import { AppHeader } from '../components/AppHeader';
import type { Team } from '../api/types';

export function TeamsListPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<Team[]>('/teams').then((data) => {
      if (!cancelled) setTeams(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="screen teams-screen">
      <AppHeader subtitle="Equipos registrados" />

      {teams === null ? (
        <div className="waiting-screen">Cargando…</div>
      ) : teams.length === 0 ? (
        <div className="card">
          <p>Todavía no se ha registrado ningún equipo.</p>
        </div>
      ) : (
        <div className="team-card-grid">
          {teams.map((team) => (
            <div key={team.id} className="team-card card">
              <div className="team-card-logo">{team.logo ?? team.name.charAt(0).toUpperCase()}</div>
              <div className="team-card-name">{team.name}</div>
              {team.members && team.members.length > 0 && (
                <ul className="team-members-list team-card-members">
                  {team.members.map((member, i) => (
                    <li key={i}>{member}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
