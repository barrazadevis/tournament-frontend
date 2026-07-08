import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet } from '../api/client';
import { connectNamespace } from '../api/socket';
import { useTeams } from '../hooks/useTeams';
import { formatSeconds } from '../utils/format';
import { AppHeader } from '../components/AppHeader';
import { PseudoEditor } from '../components/PseudoEditor';
import { teamStorageKey } from '../utils/teamStorage';
import { useModal } from '../components/ModalProvider';
import type { Match, TimerTickEvent, MatchUpdatedEvent } from '../api/types';

export function TeamMatchPage() {
  const { tournamentId = '', matchId = '', teamId = '' } = useParams();
  const navigate = useNavigate();
  const { teamName, teamLogo } = useTeams();
  const { alertModal } = useModal();
  const [match, setMatch] = useState<Match | null>(null);
  const [content, setContent] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

      <div className="match-layout">
        <div className="match-info">
          <div className="case-card card">
            <h2>{match.businessCase.title}</h2>
            <p>{match.businessCase.description}</p>
          </div>
        </div>

        <div className="match-editor">
          {banner ? (
            <div className={`status-banner ${banner.kind}`}>{banner.message}</div>
          ) : (
            <>
              <PseudoEditor
                value={content}
                onChange={setContent}
                placeholder="Estructura repetitiva + pseudocódigo (PSeInt)"
              />
              <div className="editor-footer">
                <div className="hint">
                  El profesor evaluará esto. Valida que tu algoritmo esté correcto. · {content.length} caracteres
                </div>
                <button className="submit-btn" disabled={submitting} onClick={handleSubmit}>
                  Enviar solución
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <button className="switch-team" onClick={handleSwitchTeam}>
        ¿No eres este equipo? Cambiar
      </button>
    </div>
  );
}
