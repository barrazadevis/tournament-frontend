import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { apiGet, apiPost } from '../api/client';
import { connectNamespace } from '../api/socket';
import { useTeams } from '../hooks/useTeams';
import { formatSeconds } from '../utils/format';
import { AppHeader } from '../components/AppHeader';
import { teamStorageKey } from '../utils/teamStorage';
import { useModal } from '../components/ModalProvider';
import type { ExecutionResult, Match, TimerTickEvent, MatchUpdatedEvent } from '../api/types';

export function TeamMatchPage() {
  const { tournamentId = '', matchId = '', teamId = '' } = useParams();
  const navigate = useNavigate();
  const { teamName, teamLogo } = useTeams();
  const { alertModal } = useModal();
  const [match, setMatch] = useState<Match | null>(null);
  const [content, setContent] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ExecutionResult | null>(null);
  const socketRef = useRef<ReturnType<typeof connectNamespace> | null>(null);

  const refresh = async () => {
    const data = await apiGet<Match>(`/matches/${matchId}`);
    setMatch(data);
    if (data.timerStartedAt && remaining === null) {
      const elapsed = Math.floor((Date.now() - new Date(data.timerStartedAt).getTime()) / 1000);
      setRemaining(Math.max(0, data.timerDurationSeconds - elapsed));
    }
  };

  useEffect(() => {
    refresh();
    const socket = connectNamespace('/team');
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('join_match', { matchId }));
    socket.on('timer_tick', (event: TimerTickEvent) => {
      if (event.matchId === matchId) setRemaining(event.remainingSeconds);
    });
    socket.on('match_updated', (event: MatchUpdatedEvent) => {
      if (event.matchId === matchId) refresh();
    });
    socket.on('submission_accepted', (event: { matchId: string }) => {
      if (event.matchId === matchId) refresh();
    });
    socket.on('submission_rejected', (event: { matchId: string; reason?: string }) => {
      if (event.matchId === matchId) {
        setSubmitting(false);
        void alertModal(event.reason || 'No se pudo enviar la solución.');
      }
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const handleSwitchTeam = () => {
    localStorage.removeItem(teamStorageKey(tournamentId));
    navigate(`/team/${tournamentId}`);
  };

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed) {
      void alertModal('Escribe tu solución antes de enviar.');
      return;
    }
    setSubmitting(true);
    socketRef.current?.emit('submit_solution', { matchId, teamId, content: trimmed });
  };

  const handleTestCode = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      void alertModal('Escribe tu código antes de probarlo.');
      return;
    }
    setTesting(true);
    try {
      const result = await apiPost<ExecutionResult>(`/matches/${matchId}/run`, { code: trimmed });
      setTestResult(result);
    } catch (error) {
      void alertModal(error instanceof Error ? error.message : 'No se pudo probar el código.');
    } finally {
      setTesting(false);
    }
  };

  if (!match) return <div className="waiting-screen">Cargando…</div>;

  const opponentId = match.teamAId === teamId ? match.teamBId : match.teamAId;
  const ownSubmission = match.submissions.find((s) => s.teamId === teamId);

  let banner: { kind: string; message: string } | null = null;
  if (match.status === 'RESOLVED') {
    banner =
      match.winnerId === teamId
        ? { kind: 'won', message: '¡Ganaron este match! 🎉' }
        : { kind: 'rejected', message: 'Match terminado. Ganó el equipo rival.' };
  } else if (ownSubmission) {
    banner =
      ownSubmission.verdict === 'PENDING'
        ? { kind: 'waiting', message: 'Tu solución fue enviada. Esperando el veredicto del profesor…' }
        : { kind: 'rejected', message: 'Tu solución fue rechazada. Ya no puedes reintentar en este match.' };
  } else if (match.status === 'PENDING') {
    banner = { kind: 'waiting', message: 'El profesor todavía no ha iniciado este match.' };
  }
  // Nota: si el match está AWAITING_JUDGMENT porque el RIVAL ya envió la
  // suya, este equipo puede seguir enviando la propia sin esperar — por
  // eso no hay un banner que bloquee aquí solo por ese estado.

  return (
    <div className="team-screen">
      <AppHeader />
      <div className="top-bar">
        <div className="matchup">
          {teamLogo(teamId) && <span className="team-logo-icon">{teamLogo(teamId)}</span>}
          <strong>{teamName(teamId)}</strong> vs {teamLogo(opponentId) && (
            <span className="team-logo-icon">{teamLogo(opponentId)}</span>
          )}
          {teamName(opponentId)}
        </div>
        <div className="timer-chip mono">{remaining !== null ? formatSeconds(remaining) : '--:--'}</div>
      </div>

      <div className="case-card card">
        <h2>{match.businessCase.title}</h2>
        <p>{match.businessCase.description}</p>
      </div>

      {banner ? (
        <div className={`status-banner ${banner.kind}`}>
          {banner.message}
          {ownSubmission?.executionSummary && (
            <div className="execution-summary-inline">
              {ownSubmission.executionSummary.status === 'ERROR'
                ? 'No se pudo ejecutar el código.'
                : `${ownSubmission.executionSummary.testsPassed}/${ownSubmission.executionSummary.testsTotal} casos de prueba pasados`}
            </div>
          )}
        </div>
      ) : (
        <div>
          {match.language === 'PYTHON' ? (
            <CodeMirror
              value={content}
              height="240px"
              extensions={[python()]}
              onChange={(value) => setContent(value)}
              placeholder="n = int(input())&#10;print(n * 2)"
            />
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Estructura repetitiva + pseudocódigo (PSeInt) + justificación de negocio…"
            />
          )}
          <div className="hint">El profesor evaluará esto. Sé claro y completo.</div>

          {match.language === 'PYTHON' && (
            <>
              <button className="add-member-btn" disabled={testing} onClick={handleTestCode}>
                {testing ? 'Probando…' : 'Probar código'}
              </button>
              {testResult && (
                <div className="test-result-panel card">
                  {testResult.status === 'ERROR' ? (
                    <p>No se pudo ejecutar el código — intenta de nuevo.</p>
                  ) : (
                    testResult.testResults.map((t, i) => (
                      <div key={i} className={`test-result-row ${t.passed ? 'passed' : 'failed'}`}>
                        <span>{t.passed ? '✓' : '✕'} Caso {i + 1}</span>
                        {!t.passed && (
                          <span className="test-result-detail">
                            Esperado: <code>{t.expectedOutput}</code> — Obtuviste: <code>{t.actualOutput}</code>
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}

          <button className="submit-btn" disabled={submitting} onClick={handleSubmit}>
            Enviar solución
          </button>
        </div>
      )}

      <button className="switch-team" onClick={handleSwitchTeam}>
        ¿No eres este equipo? Cambiar
      </button>
    </div>
  );
}
