import { useEffect, useState } from 'react';
import { apiGet, apiDelete, ApiError } from '../api/client';
import { AppHeader } from '../components/AppHeader';
import { useModal } from '../components/ModalProvider';
import type { Team } from '../api/types';

export function TeamsListPage() {
  const { alertModal, confirmModal } = useModal();
  const [teams, setTeams] = useState<Team[] | null>(null);

  const refresh = async () => {
    const data = await apiGet<Team[]>('/teams/roster');
    setTeams(data);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async (team: Team) => {
    const confirmed = await confirmModal(`¿Eliminar el equipo "${team.name}"?`, {
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await apiDelete(`/teams/${team.id}`);
      await refresh();
    } catch (error) {
      await alertModal(error instanceof ApiError ? error.message : 'No se pudo eliminar el equipo.');
    }
  };

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
              {team.code && <span className="team-code-badge">{team.code}</span>}
              {team.members && team.members.length > 0 && (
                <ul className="team-members-list team-card-members">
                  {team.members.map((member, i) => (
                    <li key={i}>{member}</li>
                  ))}
                </ul>
              )}
              <button
                className="btn-reject team-card-action"
                style={{ marginTop: '0.75rem' }}
                onClick={() => handleDelete(team)}
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
