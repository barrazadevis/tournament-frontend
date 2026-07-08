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

interface TestCaseInput {
  input: string;
  expectedOutput: string;
}

interface CaseInput {
  title: string;
  description: string;
  testCases: TestCaseInput[];
}

type TournamentLanguage = 'PSEINT' | 'PYTHON';

const MIN_TEST_CASES_FOR_PYTHON = 2;

export function StartTournamentPanel({ tournamentId, onStarted }: StartTournamentPanelProps) {
  const { alertModal } = useModal();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [language, setLanguage] = useState<TournamentLanguage>('PSEINT');
  const [cases, setCases] = useState<CaseInput[]>([]);
  const [timerDurationMinutes, setTimerDurationMinutes] = useState(5);
  const [starting, setStarting] = useState(false);
  const [activeTab, setActiveTab] = useState<'teams' | 'cases'>('teams');
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);

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
    setCases(roundLabels.map(() => ({ title: '', description: '', testCases: [] })));
    setActiveCaseIndex(0);
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

  const updateCase = (index: number, field: 'title' | 'description', value: string) => {
    setCases((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const addTestCase = (caseIndex: number) => {
    setCases((prev) =>
      prev.map((c, i) => (i === caseIndex ? { ...c, testCases: [...c.testCases, { input: '', expectedOutput: '' }] } : c)),
    );
  };

  const updateTestCase = (caseIndex: number, testIndex: number, field: keyof TestCaseInput, value: string) => {
    setCases((prev) =>
      prev.map((c, i) =>
        i === caseIndex
          ? { ...c, testCases: c.testCases.map((t, j) => (j === testIndex ? { ...t, [field]: value } : t)) }
          : c,
      ),
    );
  };

  const removeTestCase = (caseIndex: number, testIndex: number) => {
    setCases((prev) =>
      prev.map((c, i) => (i === caseIndex ? { ...c, testCases: c.testCases.filter((_, j) => j !== testIndex) } : c)),
    );
  };

  const canGoToCases = selectedIds.size >= 2;

  const goToCases = () => {
    if (!canGoToCases) return;
    setActiveTab('cases');
  };

  const caseIsFilled = (c: CaseInput) => {
    if (!c.title.trim() || !c.description.trim()) return false;
    if (language !== 'PYTHON') return true;
    return c.testCases.length >= MIN_TEST_CASES_FOR_PYTHON && c.testCases.every((t) => t.input.trim() && t.expectedOutput.trim());
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
    if (language === 'PYTHON' && !cases.every(caseIsFilled)) {
      await alertModal(
        `Cada caso necesita al menos ${MIN_TEST_CASES_FOR_PYTHON} casos de prueba, con entrada y salida esperada completas.`,
      );
      return;
    }

    setStarting(true);
    try {
      await apiPost(`/tournaments/${tournamentId}/start`, {
        teamIds: [...selectedIds],
        language,
        cases: cases.map((c) => ({
          title: c.title.trim(),
          description: c.description.trim(),
          testCases:
            language === 'PYTHON'
              ? c.testCases.map((t) => ({ input: t.input, expectedOutput: t.expectedOutput }))
              : undefined,
        })),
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

      <label>Lenguaje del torneo</label>
      <div className="entry-tabs">
        <button
          type="button"
          className={`entry-tab${language === 'PSEINT' ? ' active' : ''}`}
          onClick={() => setLanguage('PSEINT')}
        >
          PSeInt
        </button>
        <button
          type="button"
          className={`entry-tab${language === 'PYTHON' ? ' active' : ''}`}
          onClick={() => setLanguage('PYTHON')}
        >
          Python
        </button>
      </div>

      <div className="entry-tabs">
        <button
          type="button"
          className={`entry-tab${activeTab === 'teams' ? ' active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          1. Equipos ({selectedIds.size})
        </button>
        <button
          type="button"
          className={`entry-tab${activeTab === 'cases' ? ' active' : ''}`}
          onClick={goToCases}
          disabled={!canGoToCases}
          title={canGoToCases ? undefined : 'Selecciona al menos 2 equipos primero'}
        >
          2. Casos
        </button>
      </div>

      {activeTab === 'teams' ? (
        <>
          <div className="team-select-summary">
            <label style={{ marginBottom: 0 }}>
              Selecciona los equipos participantes ({selectedIds.size} seleccionados)
            </label>
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

          <button className="submit-btn" disabled={!canGoToCases} onClick={goToCases}>
            Siguiente: Casos →
          </button>
        </>
      ) : (
        <>
          <div className="case-tabs">
            {roundLabels.map((label, i) => {
              const filled = cases[i] ? caseIsFilled(cases[i]) : false;
              return (
                <button
                  type="button"
                  key={`${label}-${i}`}
                  className={`case-tab${activeCaseIndex === i ? ' active' : ''}`}
                  onClick={() => setActiveCaseIndex(i)}
                >
                  {label} {filled ? '✓' : ''}
                </button>
              );
            })}
          </div>

          <div className="card" style={{ background: 'var(--bg-subtle)' }}>
            <h3 style={{ marginTop: 0 }}>{roundLabels[activeCaseIndex]}</h3>
            <label>Título del caso</label>
            <input
              type="text"
              value={cases[activeCaseIndex]?.title ?? ''}
              onChange={(e) => updateCase(activeCaseIndex, 'title', e.target.value)}
              placeholder="Cálculo de bono de vendedores"
            />
            <label>Descripción del caso</label>
            <textarea
              style={{ minHeight: '100px' }}
              value={cases[activeCaseIndex]?.description ?? ''}
              onChange={(e) => updateCase(activeCaseIndex, 'description', e.target.value)}
              placeholder="Diseñar el ciclo para calcular el bono de 20 vendedores según sus ventas"
            />

            {language === 'PYTHON' && (
              <div className="test-case-editor">
                <label>
                  Casos de prueba (mínimo {MIN_TEST_CASES_FOR_PYTHON}, con entradas distintas — el equipo verá el
                  resultado al probar su código, pero nunca la salida esperada por adelantado)
                </label>
                {cases[activeCaseIndex]?.testCases.map((testCase, testIndex) => (
                  <div key={testIndex} className="test-case-row">
                    <input
                      type="text"
                      value={testCase.input}
                      onChange={(e) => updateTestCase(activeCaseIndex, testIndex, 'input', e.target.value)}
                      placeholder="Entrada (stdin)"
                    />
                    <input
                      type="text"
                      value={testCase.expectedOutput}
                      onChange={(e) => updateTestCase(activeCaseIndex, testIndex, 'expectedOutput', e.target.value)}
                      placeholder="Salida esperada"
                    />
                    <button
                      type="button"
                      className="test-case-remove-btn"
                      onClick={() => removeTestCase(activeCaseIndex, testIndex)}
                      aria-label="Quitar caso de prueba"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button type="button" className="add-member-btn" onClick={() => addTestCase(activeCaseIndex)}>
                  + Agregar caso de prueba
                </button>
              </div>
            )}

            {roundLabels.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="add-member-btn"
                  disabled={activeCaseIndex === 0}
                  onClick={() => setActiveCaseIndex((i) => Math.max(0, i - 1))}
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  className="add-member-btn"
                  disabled={activeCaseIndex === roundLabels.length - 1}
                  onClick={() => setActiveCaseIndex((i) => Math.min(roundLabels.length - 1, i + 1))}
                >
                  Siguiente caso →
                </button>
              </div>
            )}
          </div>

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
        </>
      )}
    </div>
  );
}
