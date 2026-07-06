import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet, apiPost } from '../api/client';
import { connectNamespace } from '../api/socket';
import { useTeams } from '../hooks/useTeams';
import { formatSeconds } from '../utils/format';
import { BracketView } from '../components/BracketView';
import { StartTournamentPanel } from '../components/StartTournamentPanel';
import { statusBadge } from '../utils/tournamentStatus';
import { useModal } from '../components/ModalProvider';
import type { Tournament, QualifyingRound, TimerTickEvent, TournamentFinishedEvent } from '../api/types';

export function JudgePage() {
  const { tournamentId = '' } = useParams();
  const { teamName, teamLogo } = useTeams();
  const { promptModal } = useModal();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [qualifying, setQualifying] = useState<QualifyingRound | null>(null);
  const [remainingByMatch, setRemainingByMatch] = useState<Record<string, number>>({});
  const [championId, setChampionId] = useState<string | null>(null);
  const [timerDurationMinutes, setTimerDurationMinutes] = useState(5);
  const socketRef = useRef<ReturnType<typeof connectNamespace> | null>(null);

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
    socket.on('timer_tick', (event: TimerTickEvent) => {
      setRemainingByMatch((prev) => ({ ...prev, [event.matchId]: event.remainingSeconds }));
    });
    socket.on('match_updated', refresh);
    socket.on('round_advanced', refresh);
    socket.on('tournament_finished', (event: TournamentFinishedEvent) => {
      setChampionId(event.championTeamId);
      refresh();
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const startMatch = (matchId: string) =>
    socketRef.current?.emit('start_match', { matchId, timerDurationSeconds: timerDurationMinutes * 60 });

  const judgeMatch = (matchId: string, approve: boolean) =>
    socketRef.current?.emit('judge_verdict', { matchId, approve });

  const advanceRound = async (currentRoundOrder: number, isFinalMatch: boolean) => {
    let nextRoundName = '';
    if (!isFinalMatch) {
      const input = await promptModal('Nombre de la siguiente ronda:', { placeholder: 'ej. "Semifinal"' });
      if (!input) return;
      nextRoundName = input;
    }
    socketRef.current?.emit('advance_round', {
      tournamentId,
      currentRoundOrder,
      nextRoundName,
      timerDurationSeconds: timerDurationMinutes * 60,
    });
  };

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

  if (tournament.status === 'FINISHED') {
    const finalRound = tournament.rounds[tournament.rounds.length - 1];
    const champion = championId ?? finalRound?.matches[0]?.winnerId ?? null;
    return (
      <div className="judge-page">
        <div className="champion-screen">
          <div>🏆 Torneo finalizado</div>
          <div className="champion-name">{champion ? teamName(champion) : '—'}</div>
        </div>
      </div>
    );
  }

  const remainingFor = (matchId: string, timerStartedAt: string | null, duration: number) => {
    if (remainingByMatch[matchId] !== undefined) return remainingByMatch[matchId];
    if (!timerStartedAt) return duration;
    const elapsed = Math.floor((Date.now() - new Date(timerStartedAt).getTime()) / 1000);
    return Math.max(0, duration - elapsed);
  };

  return (
    <div className="judge-page">
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
          <BracketView tournament={tournament} teamName={teamName} teamLogo={teamLogo} />
          <BracketPanel
            round={tournament.rounds[tournament.rounds.length - 1]}
            teamName={teamName}
            teamLogo={teamLogo}
            remainingFor={remainingFor}
            onStart={startMatch}
            onJudge={judgeMatch}
            onAdvance={advanceRound}
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
              <div className="submission-preview">{submission.content}</div>
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
  onJudge: (matchId: string, approve: boolean) => void;
  onAdvance: (currentRoundOrder: number, isFinalMatch: boolean) => void;
}

function BracketPanel({ round, teamName, teamLogo, remainingFor, onStart, onJudge, onAdvance }: BracketPanelProps) {
  const isFinalMatch = round.matches.length === 1;
  return (
    <div>
      <div className="round-header">
        <h2>{round.name}</h2>
        <button
          className="advance-btn"
          disabled={!round.isComplete}
          onClick={() => onAdvance(round.order, isFinalMatch)}
        >
          {isFinalMatch ? 'Finalizar torneo 🏆' : 'Avanzar de ronda'}
        </button>
      </div>

      {round.matches.map((match) => {
        const pendingSubmission = match.submissions.find((s) => s.verdict === 'PENDING');
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
                  <>
                    <button className="btn-approve" onClick={() => onJudge(match.id, true)}>Aprobar</button>
                    <button className="btn-reject" onClick={() => onJudge(match.id, false)}>Rechazar</button>
                  </>
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
              </div>
            </div>
            {match.status === 'AWAITING_JUDGMENT' && pendingSubmission && (
              <div className="submission-preview">
                <strong>{teamName(pendingSubmission.teamId)}:</strong>
                <br />
                {pendingSubmission.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
