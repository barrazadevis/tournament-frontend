export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  members?: string[];
  logo?: string;
}

export type MatchStatus = 'PENDING' | 'ACTIVE' | 'AWAITING_JUDGMENT' | 'RESOLVED';
export type Verdict = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Submission {
  id?: string;
  teamId: string;
  content: string;
  submittedAt: string;
  verdict: Verdict;
}

export interface BusinessCase {
  title: string;
  description: string;
}

export interface Match {
  id: string;
  roundName: string;
  teamAId: string;
  teamBId: string;
  status: MatchStatus;
  winnerId: string | null;
  resolution: 'WINNER' | 'NO_WINNER' | null;
  timerDurationSeconds: number;
  timerStartedAt: string | null;
  businessCase: BusinessCase;
  submissions: Submission[];
}

export interface Round {
  id: string;
  name: string;
  order: number;
  isComplete: boolean;
  matches: Match[];
}

export type TournamentStatus = 'DRAFT' | 'IN_PROGRESS' | 'FINISHED';

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  rounds: Round[];
}

export interface TournamentSummary {
  id: string;
  name: string;
  status: TournamentStatus;
}

export interface QualifyingRound {
  id: string;
  businessCase: BusinessCase;
  timerDurationSeconds: number;
  targetQualifierCount: number;
  participantTeamIds: string[];
  submissions: Submission[];
}

export interface TimerTickEvent {
  matchId: string;
  remainingSeconds: number;
}

export interface MatchUpdatedEvent {
  matchId: string;
}

export interface RoundAdvancedEvent {
  tournamentId: string;
  roundId: string;
}

export interface TournamentFinishedEvent {
  tournamentId: string;
  championTeamId: string;
}
