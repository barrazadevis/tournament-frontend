import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet } from '../api/client';
import { connectNamespace } from '../api/socket';
import { useTeams } from '../hooks/useTeams';
import { CountdownRing } from '../components/CountdownRing';
import { BracketView } from '../components/BracketView';
import type { Tournament, TimerTickEvent, TournamentFinishedEvent } from '../api/types';

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

const PARTICIPANT_BADGE: Record<ParticipantStatus, { className: string; label: string }> = {
  compite: { className: 'badge--active', label: 'Compitiendo' },
  avanza: { className: 'badge--active', label: 'Avanza' },
  eliminado: { className: 'badge--rejected', label: 'Eliminado' },
  campeon: { className: 'badge--champion', label: '🏆 Campeón' },
};

export function ViewerPage() {
  const { tournamentId = '' } = useParams();
  const { teamName, teamMembers, teamLogo } = useTeams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [remainingByMatch, setRemainingByMatch] = useState<Record<string, number>>({});
  const [championId, setChampionId] = useState<string | null>(null);
  const [view, setView] = useState<'match' | 'bracket' | 'participants'>('match');
  const socketRef = useRef<ReturnType<typeof connectNamespace> | null>(null);

  const refresh = async () => {
    const data = await apiGet<Tournament>(`/tournaments/${tournamentId}`);
    setTournament(data);

    if (data.rounds.length > 0) {
      const latestRound = data.rounds[data.rounds.length - 1];
      socketRef.current?.emit('join_tournament', { tournamentId });
      for (const match of latestRound.matches) {
        socketRef.current?.emit('join_match', { matchId: match.id });
      }
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

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  if (!tournament) {
    return <div className="waiting-screen">Cargando torneo…</div>;
  }

  if (tournament.status === 'FINISHED') {
    const finalRound = tournament.rounds[tournament.rounds.length - 1];
    const champion = championId ?? finalRound?.matches[0]?.winnerId ?? null;
    return (
      <div className="champion-screen">
        <div className="champion-label">Campeón del torneo</div>
        <div className="champion-name">
          {champion && teamLogo(champion) && <span className="team-logo-icon">{teamLogo(champion)}</span>}
          {champion ? teamName(champion) : '—'}
        </div>
      </div>
    );
  }

  if (tournament.rounds.length === 0) {
    return <div className="waiting-screen">Esperando a que el profesor inicie el torneo…</div>;
  }

  const latestRound = tournament.rounds[tournament.rounds.length - 1];
  const isHero = latestRound.matches.length === 1;

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
                      <li key={i}>{member}</li>
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

          {isHero ? (
            <div className="hero">
              <div className="case-title">{latestRound.matches[0].businessCase.title}</div>
              <div className="match-teams hero-teams">
                <div className="team-name hero-team-name">
                  {teamLogo(latestRound.matches[0].teamAId) && (
                    <span className="team-logo-icon">{teamLogo(latestRound.matches[0].teamAId)}</span>
                  )}
                  {teamName(latestRound.matches[0].teamAId)}
                </div>
                <div className="vs">VS</div>
                <div className="team-name hero-team-name">
                  {teamLogo(latestRound.matches[0].teamBId) && (
                    <span className="team-logo-icon">{teamLogo(latestRound.matches[0].teamBId)}</span>
                  )}
                  {teamName(latestRound.matches[0].teamBId)}
                </div>
              </div>
              <CountdownRing
                remainingSeconds={remainingFor(
                  latestRound.matches[0].id,
                  latestRound.matches[0].timerStartedAt,
                  latestRound.matches[0].timerDurationSeconds,
                )}
                totalSeconds={latestRound.matches[0].timerDurationSeconds}
                size={300}
                strokeWidth={14}
              />
            </div>
          ) : (
            <div className="match-grid">
              {latestRound.matches.map((match) => (
                <div key={match.id} className="match-card card">
                  <div className={`badge badge--${match.status === 'AWAITING_JUDGMENT' ? 'pending' : 'active'}`}>
                    {match.status === 'AWAITING_JUDGMENT' ? 'Esperando veredicto' : match.status}
                  </div>
                  <div className="match-teams">
                    <div className="team-name">
                      {teamLogo(match.teamAId) && <span className="team-logo-icon">{teamLogo(match.teamAId)}</span>}
                      {teamName(match.teamAId)}
                    </div>
                    <div className="vs">VS</div>
                    <div className="team-name">
                      {teamLogo(match.teamBId) && <span className="team-logo-icon">{teamLogo(match.teamBId)}</span>}
                      {teamName(match.teamBId)}
                    </div>
                  </div>
                  <CountdownRing
                    remainingSeconds={remainingFor(match.id, match.timerStartedAt, match.timerDurationSeconds)}
                    totalSeconds={match.timerDurationSeconds}
                    size={96}
                    strokeWidth={8}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
