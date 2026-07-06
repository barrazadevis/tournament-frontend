import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api/client';
import { useModal } from './ModalProvider';
import type { Team } from '../api/types';

interface StartTournamentPanelProps {
  tournamentId: string;
  onStarted: () => void;
}

export function StartTournamentPanel({ tournamentId, onStarted }: StartTournamentPanelProps) {
  const { alertModal } = useModal();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [caseTitle, setCaseTitle] = useState('');
  const [caseDescription, setCaseDescription] = useState('');
  const [timerDurationMinutes, setTimerDurationMinutes] = useState(5);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<Team[]>('/teams').then((data) => {
      if (!cancelled) setTeams(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTeam = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStart = async () => {
    if (selectedIds.size < 2) {
      await alertModal('Selecciona al menos 2 equipos.');
      return;
    }
    if (!caseTitle.trim() || !caseDescription.trim()) {
      await alertModal('Completa el título y la descripción del caso.');
      return;
    }

    setStarting(true);
    try {
      await apiPost(`/tournaments/${tournamentId}/start`, {
        teamIds: [...selectedIds],
        caseTitle: caseTitle.trim(),
        caseDescription: caseDescription.trim(),
        timerDurationSeconds: timerDurationMinutes * 60,
      });
      onStarted();
    } catch (error) {
      setStarting(false);
      await alertModal(error instanceof Error ? error.message : 'No se pudo iniciar el torneo.');
    }
  };

  if (teams.length === 0) {
    return (
      <div className="card">
        <p>Todavía no hay equipos registrados. Comparte el link de equipos primero.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Iniciar torneo</h2>

      <label>Selecciona los equipos participantes ({selectedIds.size} seleccionados)</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
        {teams.map((team) => (
          <label key={team.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
            <input
              type="checkbox"
              style={{ width: 'auto', marginBottom: 0 }}
              checked={selectedIds.has(team.id)}
              onChange={() => toggleTeam(team.id)}
            />
            {team.name}
          </label>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="seed-chips">
          {[...selectedIds].map((id) => (
            <span key={id} className="seed-chip">
              {teams.find((t) => t.id === id)?.name}
            </span>
          ))}
        </div>
      )}

      <label>Título del caso</label>
      <input
        type="text"
        value={caseTitle}
        onChange={(e) => setCaseTitle(e.target.value)}
        placeholder="Cálculo de bono de vendedores"
      />

      <label>Descripción del caso</label>
      <textarea
        style={{ minHeight: '100px' }}
        value={caseDescription}
        onChange={(e) => setCaseDescription(e.target.value)}
        placeholder="Diseñar el ciclo para calcular el bono de 20 vendedores según sus ventas"
      />

      <label>Duración del encuentro (minutos)</label>
      <input
        type="number"
        min={1}
        value={timerDurationMinutes}
        onChange={(e) => setTimerDurationMinutes(Number(e.target.value) || 5)}
      />

      <button className="submit-btn" disabled={starting} onClick={handleStart}>
        Iniciar torneo
      </button>
    </div>
  );
}
