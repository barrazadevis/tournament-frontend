import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet } from '../api/client';
import { AppHeader } from '../components/AppHeader';
import type { TournamentSummary } from '../api/types';

const DESTINATIONS: Record<string, { title: string; buildPath: (id: string) => string }> = {
  viewer: { title: 'Elige el torneo que quieres ver', buildPath: (id) => `/viewer/${id}` },
  team: { title: 'Elige el torneo de tu equipo', buildPath: (id) => `/team/${id}` },
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Sin iniciar',
  IN_PROGRESS: 'En curso',
  FINISHED: 'Finalizado',
};

export function SelectTournamentPage() {
  const { destination = '' } = useParams();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<TournamentSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<TournamentSummary[]>('/tournaments').then((data) => {
      if (!cancelled) setTournaments(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const config = DESTINATIONS[destination];

  if (!config) {
    return <p style={{ padding: '2rem' }}>Destino no válido.</p>;
  }

  return (
    <div className="screen">
      <AppHeader />
      <h2>{config.title}</h2>

      {tournaments === null ? (
        <div className="waiting-screen">Cargando…</div>
      ) : tournaments.length === 0 ? (
        <div className="card">
          <p>Todavía no hay torneos creados.</p>
        </div>
      ) : (
        <div className="tournament-picker">
          {tournaments.map((t) => (
            <button key={t.id} className="tournament-picker-item card" onClick={() => navigate(config.buildPath(t.id))}>
              <span className="teams">{t.name}</span>
              <span className={`badge badge--${t.status === 'FINISHED' ? 'active' : 'pending'}`}>
                {STATUS_LABEL[t.status] ?? t.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
