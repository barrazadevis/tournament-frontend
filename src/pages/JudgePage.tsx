import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost } from '../api/client';
import { connectNamespace } from '../api/socket';
import { useTeams } from '../hooks/useTeams';
import { formatSeconds, formatTime } from '../utils/format';
import { BracketView } from '../components/BracketView';
import { PseudoEditor } from '../components/PseudoEditor';
import { StartTournamentPanel } from '../components/StartTournamentPanel';
import { ChampionCelebration } from '../components/ChampionCelebration';
import { Modal } from '../components/Modal';
import { statusBadge } from '../utils/tournamentStatus';
import { roundNameForMatchCount } from '../utils/roundNaming';
import { useModal } from '../components/ModalProvider';
import type {
  Tournament,
  QualifyingRound,
  Submission,
  Match,
  Verdict,
  TimerTickEvent,
  TournamentFinishedEvent,
} from '../api/types';

export function JudgePage() {
  const { tournamentId = '' } = useParams();
  const navigate = useNavigate();
  const { teamName, teamLogo } = useTeams();
  const { alertModal, confirmModal } = useModal();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [qualifying, setQualifying] = useState<QualifyingRound | null>(null);
  const [remainingByMatch, setRemainingByMatch] = useState<Record<string, number>>({});
  const [championId, setChampionId] = useState<string | null>(null);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [historyMatch, setHistoryMatch] = useState<Match | null>(null);
  const [timerDurationMinutes, setTimerDurationMinutes] = useState(5);
  const socketRef = useRef<ReturnType<typeof connectNamespace> | null>(null);
  const autoAdvancedRoundIdRef = useRef<string | null>(null);

  const refresh = async () => {
    const data = await apiGet<Tournament>(`/tournaments/${tournamentId}`);
    setTournament(data);

    if (data.rounds.length === 0) {
      try {
        const round = await apiGet<QualifyingRound>(`/tournaments/${tournamentId}/qualifying-round`);
        setQualifying(round);
      } catch {
        setQualifying(null);
      }
      return;
    }

    setQualifying(null);
    const latestRound = data.rounds[data.rounds.length - 1];
    socketRef.current?.emit('join_tournament', { tournamentId });
    for (const match of latestRound.matches) {
      socketRef.current?.emit('join_match', { matchId: match.id });
    }
  };

  useEffect(() => {
    const socket = connectNamespace('/judge');
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_tournament', { tournamentId });
      refresh();
    });
    let sessionRejected = false;
    socket.on('connect_error', (error: Error) => {
      // El middleware de JudgeGateway rechaza el handshake con este mensaje
      // exacto cuando el token es inválido/expiró. Otros connect_error
      // (red inestable, etc.) los maneja solo el reintento automático del
      // cliente de socket.io, sin molestar al profesor con un modal.
      if (error.message !== 'No autorizado' || sessionRejected) return;
      sessionRejected = true;
      socket.disconnect();
      alertModal('Tu sesión expiró o no es válida. Vuelve a iniciar sesión.').then(() => navigate('/login'));
    });
    socket.on('timer_tick', (event: TimerTickEvent) => {
      setRemainingByMatch((prev) => ({ ...prev, [event.matchId]: event.remainingSeconds }));
    });
    socket.on('match_updated', refresh);
    socket.on('round_advanced', refresh);
    socket.on('tournament_finished', (event: TournamentFinishedEvent) => {
      setChampionId(event.championTeamId);
      setCelebrationOpen(true);
      refresh();
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  // Si el profesor recarga la página con el torneo ya terminado, también
  // queremos mostrar la celebración una vez (no solo cuando llega el evento
  // de socket en vivo) — pero solo se abre en esta transición, no cada vez
  // que `refresh()` vuelve a traer el mismo status.
  useEffect(() => {
    if (tournament?.status === 'FINISHED') setCelebrationOpen(true);
  }, [tournament?.status]);

  // La celebración se cierra sola para no bloquear al profesor, que necesita
  // volver a ver el panel (bracket + submissions) para revisar lo enviado.
  useEffect(() => {
    if (!celebrationOpen) return;
    const timeout = setTimeout(() => setCelebrationOpen(false), 6000);
    return () => clearTimeout(timeout);
  }, [celebrationOpen]);

  const startMatch = (matchId: string) =>
    socketRef.current?.emit('start_match', { matchId, timerDurationSeconds: timerDurationMinutes * 60 });

  const judgeMatch = (matchId: string, teamId: string, approve: boolean) =>
    socketRef.current?.emit('judge_verdict', { matchId, teamId, approve });

  const restartMatch = async (matchId: string) => {
    const confirmed = await confirmModal(
      'Nadie envió solución y el tiempo se agotó. ¿Repetir este match desde cero (mismo caso, timer nuevo)?',
      { confirmLabel: 'Repetir' },
    );
    if (!confirmed) return;
    socketRef.current?.emit('restart_match', { matchId });
  };

  const advanceRound = (currentRoundOrder: number, roundName: string) => {
    socketRef.current?.emit('advance_round', {
      tournamentId,
      currentRoundOrder,
      nextRoundName: roundName,
      timerDurationSeconds: timerDurationMinutes * 60,
    });
  };

  // Si ya se juzgaron todos los matches de la ronda actual con un ganador real,
  // avanzamos solos en vez de esperar a que el profesor le dé clic a
  // "Avanzar"/"Finalizar torneo". Si algún match quedó NO_WINNER (nadie
  // envió, se agotó el tiempo), el backend exige una decisión manual del
  // profesor (repetir el match) antes de poder avanzar — ahí NO se dispara
  // el auto-avance. El ref evita reintentar para la misma ronda en cada
  // refresh mientras el backend procesa el avance.
  useEffect(() => {
    if (!tournament || tournament.rounds.length === 0) return;
    const round = tournament.rounds[tournament.rounds.length - 1];
    if (autoAdvancedRoundIdRef.current === round.id) return;
    if (!round.isComplete || round.matches.some((m) => m.resolution !== 'WINNER')) return;

    autoAdvancedRoundIdRef.current = round.id;
    advanceRound(round.order, roundNameForMatchCount(round.matches.length / 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament]);

  const judgeQualifying = async (teamId: string, approve: boolean) => {
    await apiPost(`/tournaments/${tournamentId}/qualifying-submissions/${teamId}/verdict`, { approve });
    refresh();
  };

  const finalizeQualifying = async () => {
    await apiPost(`/tournaments/${tournamentId}/qualifying-round/finalize`);
    refresh();
  };

  if (!tournament) {
    return (
      <div className="judge-page">
        <div className="waiting-screen">Cargando…</div>
      </div>
    );
  }

  const finalRound = tournament.rounds[tournament.rounds.length - 1];
  const champion = championId ?? finalRound?.matches[0]?.winnerId ?? null;

  const remainingFor = (matchId: string, timerStartedAt: string | null, duration: number) => {
    if (remainingByMatch[matchId] !== undefined) return remainingByMatch[matchId];
    if (!timerStartedAt) return duration;
    const elapsed = Math.floor((Date.now() - new Date(timerStartedAt).getTime()) / 1000);
    return Math.max(0, duration - elapsed);
  };

  return (
    <div className="judge-page">
      {celebrationOpen && tournament.status === 'FINISHED' && (
        <Modal onClose={() => setCelebrationOpen(false)}>
          <ChampionCelebration
            championName={champion ? teamName(champion) : '—'}
            championLogo={champion ? teamLogo(champion) : undefined}
          />
        </Modal>
      )}
      {historyMatch && (
        <Modal onClose={() => setHistoryMatch(null)}>
          <MatchHistoryPanel match={historyMatch} teamName={teamName} />
        </Modal>
      )}
      <header className="judge-header">
        <div>
          <div className="judge-header-eyebrow">Panel del juez</div>
          <h1>
            {tournament.name}{' '}
            <span className={`badge ${statusBadge(tournament.status).className}`}>
              {statusBadge(tournament.status).label}
            </span>
          </h1>
        </div>
        <label className="config-bar">
          Duración de match:
          <input
            type="number"
            value={timerDurationMinutes}
            min={1}
            onChange={(e) => setTimerDurationMinutes(Number(e.target.value) || 5)}
          />
          min
        </label>
      </header>

      {qualifying ? (
        <QualifyingPanel
          qualifying={qualifying}
          teamName={teamName}
          onJudge={judgeQualifying}
          onFinalize={finalizeQualifying}
        />
      ) : tournament.rounds.length === 0 ? (
        <StartTournamentPanel tournamentId={tournamentId} onStarted={refresh} />
      ) : (
        <>
          <BracketView
            tournament={tournament}
            teamName={teamName}
            teamLogo={teamLogo}
            onSelectMatch={setHistoryMatch}
          />
          <BracketPanel
            round={tournament.rounds[tournament.rounds.length - 1]}
            teamName={teamName}
            teamLogo={teamLogo}
            remainingFor={remainingFor}
            onStart={startMatch}
            onJudge={judgeMatch}
            onAdvance={advanceRound}
            onRestart={restartMatch}
            finished={tournament.status === 'FINISHED'}
          />
        </>
      )}
    </div>
  );
}

interface QualifyingPanelProps {
  qualifying: QualifyingRound;
  teamName: (id: string) => string;
  onJudge: (teamId: string, approve: boolean) => void;
  onFinalize: () => void;
}

function QualifyingPanel({ qualifying, teamName, onJudge, onFinalize }: QualifyingPanelProps) {
  const submissionsByTeam = new Map(qualifying.submissions.map((s) => [s.teamId, s]));
  const allJudged =
    qualifying.submissions.length === qualifying.participantTeamIds.length &&
    qualifying.submissions.every((s) => s.verdict !== 'PENDING');

  return (
    <div>
      <div className="round-header">
        <h2>Ronda clasificatoria — avanzan {qualifying.targetQualifierCount} equipos</h2>
        <button className="advance-btn" disabled={!allJudged} onClick={onFinalize}>
          Finalizar clasificatoria
        </button>
      </div>

      {qualifying.participantTeamIds.map((teamId) => {
        const submission = submissionsByTeam.get(teamId);
        return (
          <div key={teamId} className="match-row card">
            <div className="match-row-top">
              <div className="teams">{teamName(teamId)}</div>
              <div className="actions">
                {!submission && <span className="badge badge--pending">Sin enviar</span>}
                {submission?.verdict === 'PENDING' && (
                  <>
                    <span className="badge badge--pending">Por juzgar</span>
                    <button className="btn-approve" onClick={() => onJudge(teamId, true)}>Aprobar</button>
                    <button className="btn-reject" onClick={() => onJudge(teamId, false)}>Rechazar</button>
                  </>
                )}
                {submission?.verdict === 'APPROVED' && <span className="badge badge--active">Aprobada</span>}
                {submission?.verdict === 'REJECTED' && <span className="badge badge--rejected">Rechazada</span>}
              </div>
            </div>
            {submission?.verdict === 'PENDING' && (
              <PseudoEditor value={submission.content} readOnly compact fileName={`${teamName(teamId)}.psc`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface BracketPanelProps {
  round: Tournament['rounds'][number];
  teamName: (id: string) => string;
  teamLogo: (id: string) => string | undefined;
  remainingFor: (matchId: string, timerStartedAt: string | null, duration: number) => number;
  onStart: (matchId: string) => void;
  onJudge: (matchId: string, teamId: string, approve: boolean) => void;
  onAdvance: (currentRoundOrder: number, roundName: string) => void;
  onRestart: (matchId: string) => void;
  finished: boolean;
}

function BracketPanel({
  round,
  teamName,
  teamLogo,
  remainingFor,
  onStart,
  onJudge,
  onAdvance,
  onRestart,
  finished,
}: BracketPanelProps) {
  const isFinalMatch = round.matches.length === 1;
  const upcomingRoundName = roundNameForMatchCount(round.matches.length / 2);
  // Cuando todos los matches ya tienen un ganador real, JudgePage avanza
  // solo (ver el useEffect de auto-avance) — el botón se deshabilita para
  // no disparar un segundo `advance_round` en carrera con ese auto-avance.
  const readyToAutoAdvance = round.isComplete && round.matches.every((m) => m.resolution === 'WINNER');
  return (
    <div>
      <div className="round-header">
        <h2>{round.name}</h2>
        {!finished && (
          <button
            className="advance-btn"
            disabled={!round.isComplete || readyToAutoAdvance}
            onClick={() => onAdvance(round.order, upcomingRoundName)}
          >
            {readyToAutoAdvance ? 'Avanzando…' : isFinalMatch ? 'Finalizar torneo' : `Avanzar a ${upcomingRoundName}`}
          </button>
        )}
      </div>

      {round.matches.map((match) => {
        const pendingSubmissions = match.submissions
          .filter((s) => s.verdict === 'PENDING')
          .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
        const canRestart =
          match.status === 'RESOLVED' && match.resolution === 'NO_WINNER' && match.submissions.length === 0;
        return (
          <div key={match.id} className={`match-row card${match.status === 'ACTIVE' ? ' match-row--active' : ''}`}>
            <div className="match-row-top">
              <div className="teams">
                {teamLogo(match.teamAId) && <span className="team-logo-icon">{teamLogo(match.teamAId)}</span>}
                {teamName(match.teamAId)} vs {teamLogo(match.teamBId) && (
                  <span className="team-logo-icon">{teamLogo(match.teamBId)}</span>
                )}
                {teamName(match.teamBId)}
              </div>
              <div className="actions">
                {match.status === 'PENDING' && (
                  <button className="btn-start" onClick={() => onStart(match.id)}>Iniciar match</button>
                )}
                {match.status === 'AWAITING_JUDGMENT' && (
                  <span className="badge badge--pending">
                    {pendingSubmissions.length} por juzgar
                  </span>
                )}
                {match.status === 'RESOLVED' &&
                  (match.winnerId ? (
                    <span className="badge badge--active">Ganó {teamName(match.winnerId)}</span>
                  ) : (
                    <span className="badge badge--rejected">Sin ganador</span>
                  ))}
                {match.status === 'ACTIVE' && (
                  <span className="timer-label mono">
                    {formatSeconds(remainingFor(match.id, match.timerStartedAt, match.timerDurationSeconds))}
                  </span>
                )}
                {canRestart && (
                  <button className="btn-start" onClick={() => onRestart(match.id)}>
                    Repetir match
                  </button>
                )}
              </div>
            </div>
            {pendingSubmissions.length > 0 && (
              <SubmissionsPanel
                matchId={match.id}
                submissions={pendingSubmissions}
                teamName={teamName}
                onJudge={onJudge}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface SubmissionsPanelProps {
  matchId: string;
  submissions: Submission[];
  teamName: (id: string) => string;
  onJudge: (matchId: string, teamId: string, approve: boolean) => void;
}

function SubmissionsPanel({ matchId, submissions, teamName, onJudge }: SubmissionsPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = submissions[Math.min(activeIndex, submissions.length - 1)];

  return (
    <div className="submission-panel">
      {submissions.length > 1 && (
        <div className="submission-tabs">
          {submissions.map((submission, index) => (
            <button
              key={submission.teamId}
              type="button"
              className={`submission-tab${index === activeIndex ? ' active' : ''}`}
              onClick={() => setActiveIndex(index)}
            >
              {teamName(submission.teamId)}
              {index === 0 ? ' · primero' : ''}
            </button>
          ))}
        </div>
      )}
      <div className="submission-meta">envió a las {formatTime(active.submittedAt)}</div>
      <PseudoEditor value={active.content} readOnly compact fileName={`${teamName(active.teamId)}.psc`} />
      <div className="actions">
        <button className="btn-approve" onClick={() => onJudge(matchId, active.teamId, true)}>
          Aprobar
        </button>
        <button className="btn-reject" onClick={() => onJudge(matchId, active.teamId, false)}>
          Rechazar
        </button>
      </div>
    </div>
  );
}

function verdictBadge(verdict: Verdict): { className: string; label: string } {
  if (verdict === 'APPROVED') return { className: 'badge--active', label: 'Aprobada' };
  if (verdict === 'REJECTED') return { className: 'badge--rejected', label: 'Rechazada' };
  return { className: 'badge--pending', label: 'Por juzgar' };
}

interface MatchHistoryPanelProps {
  match: Match;
  teamName: (id: string) => string;
}

/**
 * Detalle de un match ya sea de la ronda actual o de una anterior — se abre
 * al hacer clic en cualquier casilla del bracket. Muestra el envío de CADA
 * equipo (aprobado, rechazado o sin enviar), no solo el pendiente de
 * juzgar como `SubmissionsPanel`; es el "histórico" para que el profesor
 * pueda volver a revisar una solución después de juzgarla.
 */
function MatchHistoryPanel({ match, teamName }: MatchHistoryPanelProps) {
  return (
    <div className="match-history-panel card">
      <h2>{match.roundName}</h2>
      <div className="match-history-subtitle">
        {teamName(match.teamAId)} vs {teamName(match.teamBId)}
        {match.winnerId ? ` · Ganó ${teamName(match.winnerId)}` : ''}
      </div>

      {[match.teamAId, match.teamBId].map((teamId) => {
        const submission = match.submissions.find((s) => s.teamId === teamId);
        const badge = submission ? verdictBadge(submission.verdict) : null;
        return (
          <div key={teamId} className="match-history-entry">
            <div className="match-history-entry-top">
              <strong>{teamName(teamId)}</strong>
              {badge ? (
                <>
                  <span className={`badge ${badge.className}`}>{badge.label}</span>
                  <span className="submission-meta">envió a las {formatTime(submission!.submittedAt)}</span>
                </>
              ) : (
                <span className="badge badge--pending">Sin envío</span>
              )}
            </div>
            {submission && (
              <PseudoEditor value={submission.content} readOnly compact fileName={`${teamName(teamId)}.psc`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
