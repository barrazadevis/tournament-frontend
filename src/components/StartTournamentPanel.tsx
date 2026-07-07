import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../api/client';
import { useModal } from './ModalProvider';
import { roundLabelsFor } from '../utils/powerOfTwo';
import { roundNameForMatchCount } from '../utils/roundNaming';
import type { Team } from '../api/types';

interface StartTournamentPanelProps {
  tournamentId: string;
  onStarted: () => void;
}

interface CaseInput {
  title: string;
  description: string;
}

export function StartTournamentPanel({ tournamentId, onStarted }: StartTournamentPanelProps) {
  const { alertModal } = useModal();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cases, setCases] = useState<CaseInput[]>([]);
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

  const roundLabels = useMemo(
    () => roundLabelsFor(selectedIds.size, roundNameForMatchCount),
    [selectedIds.size],
  );
  const roundLabelsKey = roundLabels.join('|');

  // Se reinicia completo cuando cambia la estructura de rondas (contenido u
  // orden de las etiquetas) — no se intenta preservar contenido parcial a
  // través de un cambio estructural (ej. cruzar un umbral de potencia de 2).
  useEffect(() => {
    setCases(roundLabels.map(() => ({ title: '', description: '' })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundLabelsKey]);

  const toggleTeam = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateCase = (index: number, field: keyof CaseInput, value: string) => {
    setCases((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const handleStart = async () => {
    if (selectedIds.size < 2) {
      await alertModal('Selecciona al menos 2 equipos.');
      return;
    }
    if (cases.some((c) => !c.title.trim() || !c.description.trim())) {
      await alertModal('Completa el título y la descripción de cada caso.');
      return;
    }

    setStarting(true);
    try {
      await apiPost(`/tournaments/${tournamentId}/start`, {
        teamIds: [...selectedIds],
        cases: cases.map((c) => ({ title: c.title.trim(), description: c.description.trim() })),
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

      <div className="team-select-summary">
        <label style={{ marginBottom: 0 }}>Selecciona los equipos participantes ({selectedIds.size} seleccionados)</label>
        {selectedIds.size > 0 && (
          <button type="button" className="team-select-clear" onClick={() => setSelectedIds(new Set())}>
            Limpiar selección
          </button>
        )}
      </div>
      <div className="team-select-grid">
        {teams.map((team) => {
          const selected = selectedIds.has(team.id);
          return (
            <button
              type="button"
              key={team.id}
              className={`team-select-option${selected ? ' selected' : ''}`}
              onClick={() => toggleTeam(team.id)}
              aria-pressed={selected}
            >
              <span className="team-select-logo">{team.logo ?? team.name.charAt(0).toUpperCase()}</span>
              <span className="team-select-name">{team.name}</span>
              <span className="team-select-check">{selected ? '✓' : ''}</span>
            </button>
          );
        })}
      </div>

      {roundLabels.length > 0 && (
        <>
          <div className="hint" style={{ marginBottom: '1rem' }}>
            {roundLabels.length === 1
              ? 'Se necesita 1 caso para esta ronda.'
              : `Se necesitan ${roundLabels.length} casos, uno por ronda.`}
          </div>
          {roundLabels.map((label, i) => (
            <div key={`${label}-${i}`} className="card" style={{ background: 'var(--bg-subtle)', marginBottom: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>{label}</h3>
              <label>Título del caso</label>
              <input
                type="text"
                value={cases[i]?.title ?? ''}
                onChange={(e) => updateCase(i, 'title', e.target.value)}
                placeholder="Cálculo de bono de vendedores"
              />
              <label>Descripción del caso</label>
              <textarea
                style={{ minHeight: '100px' }}
                value={cases[i]?.description ?? ''}
                onChange={(e) => updateCase(i, 'description', e.target.value)}
                placeholder="Diseñar el ciclo para calcular el bono de 20 vendedores según sus ventas"
              />
            </div>
          ))}
        </>
      )}

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
