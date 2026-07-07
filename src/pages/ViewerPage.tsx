import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet } from '../api/client';
import { connectNamespace } from '../api/socket';
import { useTeams } from '../hooks/useTeams';
import { CountdownRing } from '../components/CountdownRing';
import { CountdownBar } from '../components/CountdownBar';
import { BracketView } from '../components/BracketView';
import { ChampionCelebration } from '../components/ChampionCelebration';
import { matchStatusBadge } from '../utils/matchStatus';
import type { Match, Tournament, QualifyingRound, Submission, TimerTickEvent, TournamentFinishedEvent } from '../api/types';

type ParticipantStatus = 'compite' | 'avanza' | 'eliminado' | 'campeon';

function computeParticipants(tournament: Tournament): { teamId: string; status: ParticipantStatus }[] {
  const round0 = tournament.rounds[0];
  const participantIds = new Set<string>();
  for (const match of round0.matches) {
    participantIds.add(match.teamAId);
    participantIds.add(match.teamBId);
  }

  const lastRoundIndex = tournament.rounds.length - 1;

  return [...participantIds].map((teamId) => {
    for (let i = lastRoundIndex; i >= 0; i--) {
      const match = tournament.rounds[i].matches.find((m) => m.teamAId === teamId || m.teamBId === teamId);
      if (!match) continue;

      if (!match.winnerId) return { teamId, status: 'compite' as const };
      if (match.winnerId !== teamId) return { teamId, status: 'eliminado' as const };
      const isFinal = i === lastRoundIndex && tournament.rounds[i].matches.length === 1;
      return { teamId, status: isFinal ? ('campeon' as const) : ('avanza' as const) };
    }
    return { teamId, status: 'compite' as const };
  });
}

/** Solo tiene sentido mostrarlo mientras el match está en curso o esperando
 * veredicto — antes de eso nadie ha podido enviar nada, y después ya está resuelto. */
function submissionIndicator(match: Match, teamId: string): string | null {
  if (match.status !== 'ACTIVE' && match.status !== 'AWAITING_JUDGMENT') return null;
  const submitted = match.submissions.some((s) => s.teamId === teamId);
  return submitted ? '✓ Enviado' : '⏳ Esperando';
}

const PARTICIPANT_BADGE: Record<ParticipantStatus, { className: string; label: string }> = {
  compite: { className: 'badge--active', label: 'Compitiendo' },
  avanza: { className: 'badge--active', label: 'Avanza' },
  eliminado: { className: 'badge--rejected', label: 'Eliminado' },
  campeon: { className: 'badge--champion', label: '🏆 Campeón' },
};

interface QualifyingViewerPanelProps {
  readonly qualifying: QualifyingRound;
  readonly teamName: (id: string) => string;
  readonly teamLogo: (id: string) => string | undefined;
}

function qualifyingSubmissionBadge(submission: Submission | undefined): { className: string; label: string } {
  if (!submission) return { className: 'badge--pending', label: 'Sin enviar' };
  if (submission.verdict === 'PENDING') return { className: 'badge--pending', label: 'Por juzgar' };
  if (submission.verdict === 'APPROVED') return { className: 'badge--active', label: 'Aprobada' };
  return { className: 'badge--rejected', label: 'Rechazada' };
}

interface MatchFocusViewProps {
  readonly match: Match;
  readonly teamName: (id: string) => string;
  readonly teamLogo: (id: string) => string | undefined;
  readonly teamMembers: (id: string) => string[];
  readonly remainingSeconds: number;
  readonly onBack?: () => void;
}

/**
 * Tratamiento "grande" de un match: nombres enormes, timer circular
 * protagonista + roster de cada equipo debajo. Se usa tanto para la Final
 * (automático, sin `onBack`) como para cualquier match de la grilla que el
 * profesor elija enfocar con un clic (con botón "Volver a la grilla").
 */
function MatchFocusView({ match, teamName, teamLogo, teamMembers, remainingSeconds, onBack }: MatchFocusViewProps) {
  return (
    <div className="hero">
      {onBack && (
        <button type="button" className="hero-back-btn" onClick={onBack}>
          ← Volver a la grilla
        </button>
      )}

      <div className="case-title">{match.businessCase.title}</div>
      <div className="match-teams hero-teams">
        <div className="team-name hero-team-name">
          {teamLogo(match.teamAId) && <span className="team-logo-icon">{teamLogo(match.teamAId)}</span>}
          {teamName(match.teamAId)}
        </div>
        <div className="vs">VS</div>
        <div className="team-name hero-team-name">
          {teamLogo(match.teamBId) && <span className="team-logo-icon">{teamLogo(match.teamBId)}</span>}
          {teamName(match.teamBId)}
        </div>
      </div>

      <div className="hero-timer">
        <div className="hero-timer-label">Tiempo restante</div>
        <CountdownRing remainingSeconds={remainingSeconds} totalSeconds={match.timerDurationSeconds} size={320} strokeWidth={14} />
      </div>

      <div className="hero-rosters">
        {[match.teamAId, match.teamBId].map((teamId) => (
          <div key={teamId} className="hero-roster-card card">
            <div className="hero-roster-team">
              {teamLogo(teamId) && <span className="team-logo-icon">{teamLogo(teamId)}</span>}
              {teamName(teamId)}
            </div>
            {teamMembers(teamId).length > 0 && (
              <ul className="team-members-list">
                {teamMembers(teamId).map((member, i) => (
                  <li key={`${member}-${i}`}>{member}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Vista de solo lectura de la clasificatoria para el proyector — mismo
 * contenido que ve el profesor en QualifyingPanel (JudgePage), sin los
 * botones de aprobar/rechazar. No hay countdown: QualifyingRound no trackea
 * un timerStartedAt server-side como sí lo hace Match.
 */
function QualifyingViewerPanel({ qualifying, teamName, teamLogo }: QualifyingViewerPanelProps) {
  const submissionsByTeam = new Map(qualifying.submissions.map((s) => [s.teamId, s]));

  return (
    <div className="viewer-screen">
      <h1 className="round-name">Ronda clasificatoria — avanzan {qualifying.targetQualifierCount} equipos</h1>

      <div className="case-card card">
        <h2>{qualifying.businessCase.title}</h2>
        <p>{qualifying.businessCase.description}</p>
      </div>

      <div className="team-card-grid">
        {qualifying.participantTeamIds.map((teamId) => {
          const badge = qualifyingSubmissionBadge(submissionsByTeam.get(teamId));

          return (
            <div key={teamId} className="team-card card">
              <div className="team-card-logo">{teamLogo(teamId) ?? teamName(teamId).charAt(0).toUpperCase()}</div>
              <div className="team-card-name">{teamName(teamId)}</div>
              <span className={`badge ${badge.className}`}>{badge.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ViewerPage() {
  const { tournamentId = '' } = useParams();
  const { teamName, teamMembers, teamLogo } = useTeams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [qualifying, setQualifying] = useState<QualifyingRound | null>(null);
  const [remainingByMatch, setRemainingByMatch] = useState<Record<string, number>>({});
  const [championId, setChampionId] = useState<string | null>(null);
  const [view, setView] = useState<'match' | 'bracket' | 'participants'>('match');
  const [focusedMatchId, setFocusedMatchId] = useState<string | null>(null);
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
    const latestRound = data.rounds.at(-1)!;
    socketRef.current?.emit('join_tournament', { tournamentId });
    for (const match of latestRound.matches) {
      socketRef.current?.emit('join_match', { matchId: match.id });
    }
  };

  useEffect(() => {
    const socket = connectNamespace('/viewer');
    socketRef.current = socket;

    socket.on('connect', refresh);
    socket.on('timer_tick', (event: TimerTickEvent) => {
      setRemainingByMatch((prev) => ({ ...prev, [event.matchId]: event.remainingSeconds }));
    });
    socket.on('match_updated', refresh);
    socket.on('round_advanced', refresh);
    socket.on('tournament_finished', (event: TournamentFinishedEvent) => {
      setChampionId(event.championTeamId);
      refresh();
    });

    // No hay evento de socket para submissions/veredictos de la clasificatoria
    // (TournamentEventBus solo emite timer_tick/match_updated/round_advanced/
    // tournament_finished) — se hace polling mientras no exista ninguna Round
    // todavía, igual que TeamPortalPage hace con el estado del equipo.
    const pollId = setInterval(() => {
      if (!socketRef.current) return;
      refresh();
    }, 4000);

    return () => {
      socket.disconnect();
      clearInterval(pollId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  if (!tournament) {
    return <div className="waiting-screen">Cargando torneo…</div>;
  }

  if (tournament.status === 'FINISHED') {
    const finalRound = tournament.rounds.at(-1);
    const champion = championId ?? finalRound?.matches[0]?.winnerId ?? null;
    return (
      <ChampionCelebration
        championName={champion ? teamName(champion) : '—'}
        championLogo={champion ? teamLogo(champion) : undefined}
      />
    );
  }

  if (tournament.rounds.length === 0) {
    if (qualifying) {
      return <QualifyingViewerPanel qualifying={qualifying} teamName={teamName} teamLogo={teamLogo} />;
    }
    return <div className="waiting-screen">Esperando a que el profesor inicie el torneo…</div>;
  }

  const latestRound = tournament.rounds.at(-1)!;
  const isHero = latestRound.matches.length === 1;
  const currentRoundNumber = tournament.rounds.length;
  const totalRounds = currentRoundNumber + Math.log2(latestRound.matches.length);

  const remainingFor = (matchId: string, timerStartedAt: string | null, duration: number) => {
    if (remainingByMatch[matchId] !== undefined) return remainingByMatch[matchId];
    if (!timerStartedAt) return duration;
    const elapsed = Math.floor((Date.now() - new Date(timerStartedAt).getTime()) / 1000);
    return Math.max(0, duration - elapsed);
  };

  return (
    <div className="viewer-screen">
      <div className="viewer-top-bar">
        <div className="tournament-title">{tournament.name}</div>
        <div className="viewer-tabs">
          <button
            className={`bracket-toggle-btn${view === 'match' ? ' active' : ''}`}
            onClick={() => setView('match')}
          >
            Ver match
          </button>
          <button
            className={`bracket-toggle-btn${view === 'bracket' ? ' active' : ''}`}
            onClick={() => setView('bracket')}
          >
            Ver bracket
          </button>
          <button
            className={`bracket-toggle-btn${view === 'participants' ? ' active' : ''}`}
            onClick={() => setView('participants')}
          >
            Ver participantes
          </button>
        </div>
      </div>

      {view === 'bracket' && <BracketView tournament={tournament} teamName={teamName} teamLogo={teamLogo} />}

      {view === 'participants' && (
        <div className="team-card-grid">
          {computeParticipants(tournament).map(({ teamId, status }) => {
            const members = teamMembers(teamId);
            return (
              <div key={teamId} className="team-card card">
                <div className="team-card-logo">{teamLogo(teamId) ?? teamName(teamId).charAt(0).toUpperCase()}</div>
                <div className="team-card-name">{teamName(teamId)}</div>
                <span className={`badge ${PARTICIPANT_BADGE[status].className}`}>
                  {PARTICIPANT_BADGE[status].label}
                </span>
                {members.length > 0 && (
                  <ul className="team-members-list team-card-members">
                    {members.map((member, i) => (
                      <li key={`${member}-${i}`}>{member}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'match' && (
        <>
          <h1 className="round-name">{latestRound.name}</h1>
          <div className="round-progress">
            Ronda {currentRoundNumber} de {totalRounds}
          </div>

          {(() => {
            const focusedMatch = isHero
              ? latestRound.matches[0]
              : latestRound.matches.find((m) => m.id === focusedMatchId);

            if (focusedMatch) {
              return (
                <MatchFocusView
                  match={focusedMatch}
                  teamName={teamName}
                  teamLogo={teamLogo}
                  teamMembers={teamMembers}
                  remainingSeconds={remainingFor(
                    focusedMatch.id,
                    focusedMatch.timerStartedAt,
                    focusedMatch.timerDurationSeconds,
                  )}
                  onBack={isHero ? undefined : () => setFocusedMatchId(null)}
                />
              );
            }

            return (
              <div className="match-grid">
                {latestRound.matches.map((match) => {
                  const submissionA = submissionIndicator(match, match.teamAId);
                  const submissionB = submissionIndicator(match, match.teamBId);
                  return (
                    <div
                      key={match.id}
                      className="match-card card"
                      onClick={() => setFocusedMatchId(match.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setFocusedMatchId(match.id)}
                    >
                      <div className={`badge ${matchStatusBadge(match.status).className}`}>
                        {matchStatusBadge(match.status).label}
                      </div>
                      <div className="match-teams">
                        <div className="team-name">
                          {teamLogo(match.teamAId) && (
                            <span className="team-logo-icon">{teamLogo(match.teamAId)}</span>
                          )}
                          {teamName(match.teamAId)}
                        </div>
                        <div className="vs">VS</div>
                        <div className="team-name">
                          {teamLogo(match.teamBId) && (
                            <span className="team-logo-icon">{teamLogo(match.teamBId)}</span>
                          )}
                          {teamName(match.teamBId)}
                        </div>
                      </div>
                      {(submissionA || submissionB) && (
                        <div className="match-submission-row">
                          <span>{submissionA}</span>
                          <span>{submissionB}</span>
                        </div>
                      )}
                      <CountdownBar
                        remainingSeconds={remainingFor(match.id, match.timerStartedAt, match.timerDurationSeconds)}
                        totalSeconds={match.timerDurationSeconds}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
