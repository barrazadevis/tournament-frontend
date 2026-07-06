import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPatch, apiDelete, apiPost, ApiError } from '../api/client';
import { AppHeader } from '../components/AppHeader';
import { StartTournamentPanel } from '../components/StartTournamentPanel';
import { statusBadge } from '../utils/tournamentStatus';
import { useModal } from '../components/ModalProvider';
import type { TournamentSummary } from '../api/types';

export function ManageTournamentsPage() {
  const { alertModal, confirmModal, promptModal } = useModal();
  const [tournaments, setTournaments] = useState<TournamentSummary[] | null>(null);
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);

  const refresh = async () => {
    const data = await apiGet<TournamentSummary[]>('/tournaments');
    setTournaments(data);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleRename = async (t: TournamentSummary) => {
    const name = await promptModal('Nuevo nombre del torneo:', { defaultValue: t.name });
    if (!name) return;
    try {
      await apiPatch(`/tournaments/${t.id}`, { name });
      refresh();
    } catch (error) {
      await alertModal(error instanceof ApiError ? error.message : 'No se pudo renombrar el torneo.');
    }
  };

  const handleDelete = async (t: TournamentSummary) => {
    const confirmed = await confirmModal(
      `¿Eliminar "${t.name}"? Esto borra todo su progreso (rondas, matches, clasificatoria) y no se puede deshacer.`,
      { confirmLabel: 'Eliminar', danger: true },
    );
    if (!confirmed) return;
    try {
      await apiDelete(`/tournaments/${t.id}`);
      refresh();
    } catch (error) {
      await alertModal(error instanceof ApiError ? error.message : 'No se pudo eliminar el torneo.');
    }
  };

  const handleReset = async (t: TournamentSummary) => {
    const confirmed = await confirmModal(
      `¿Reiniciar "${t.name}"? Se borra todo el progreso (rondas, matches, clasificatoria) y vuelve a quedar sin iniciar, con el mismo nombre.`,
      { confirmLabel: 'Reiniciar', danger: true },
    );
    if (!confirmed) return;
    try {
      await apiPost(`/tournaments/${t.id}/reset`);
      refresh();
    } catch (error) {
      await alertModal(error instanceof ApiError ? error.message : 'No se pudo reiniciar el torneo.');
    }
  };

  return (
    <div className="screen tournaments-admin-screen">
      <AppHeader subtitle="Gestionar torneos" />

      {tournaments === null ? (
        <div className="waiting-screen">Cargando…</div>
      ) : tournaments.length === 0 ? (
        <div className="card">
          <p>Todavía no hay torneos creados.</p>
        </div>
      ) : (
        <div className="tournament-admin-list">
          {tournaments.map((t) => {
            const badge = statusBadge(t.status);
            const isDraft = t.status === 'DRAFT';
            return (
              <div key={t.id} className="tournament-admin-card card">
                <div className="tournament-admin-top">
                  <div>
                    <div className="tournament-admin-name">{t.name}</div>
                    <span className={`badge ${badge.className}`}>{badge.label}</span>
                  </div>
                  <div className="tournament-admin-actions">
                    {!isDraft && (
                      <Link className="btn-approve" to={`/judge/${t.id}`}>
                        Panel del juez
                      </Link>
                    )}
                    {isDraft && (
                      <button
                        className="btn-start"
                        onClick={() => setExpandedDraftId(expandedDraftId === t.id ? null : t.id)}
                      >
                        {expandedDraftId === t.id ? 'Ocultar' : 'Agregar equipos / iniciar'}
                      </button>
                    )}
                    <button className="add-member-btn" onClick={() => handleRename(t)}>
                      Renombrar
                    </button>
                    {!isDraft && (
                      <button className="add-member-btn" onClick={() => handleReset(t)}>
                        Reiniciar
                      </button>
                    )}
                    <button className="btn-reject" onClick={() => handleDelete(t)}>
                      Eliminar
                    </button>
                  </div>
                </div>

                {isDraft && expandedDraftId === t.id && (
                  <StartTournamentPanel
                    tournamentId={t.id}
                    onStarted={() => {
                      setExpandedDraftId(null);
                      refresh();
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
