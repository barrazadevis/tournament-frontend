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
  /** Solo presente en la respuesta de registro (una vez) y en /teams/roster (profesor). */
  code?: string;
}

export type MatchStatus = 'PENDING' | 'ACTIVE' | 'AWAITING_JUDGMENT' | 'RESOLVED';
export type Verdict = 'PENDING' | 'APPROVED' | 'REJECTED';
export type TournamentLanguage = 'PSEINT' | 'PYTHON';

export interface TestCaseExecutionResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
}

export interface ExecutionResult {
  status: 'RAN' | 'ERROR';
  testResults: TestCaseExecutionResult[];
  stderr: string | null;
}

export interface ExecutionSummary {
  status: 'RAN' | 'ERROR';
  testsPassed: number;
  testsTotal: number;
}

export interface Submission {
  id?: string;
  teamId: string;
  content: string;
  submittedAt: string;
  verdict: Verdict;
  /** Detalle completo — solo presente en la vista del profesor (GET /tournaments/:id). */
  executionResult?: ExecutionResult | null;
  /** Resumen sin detalle — solo presente en la vista del equipo (GET /matches/:matchId), para no filtrarle al rival su stdout. */
  executionSummary?: ExecutionSummary | null;
}

export interface BusinessCase {
  title: string;
  description: string;
}

export interface Match {
  id: string;
  language: TournamentLanguage;
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

export type TournamentStatus = 'DRAFT' | 'QUALIFYING' | 'IN_PROGRESS' | 'FINISHED';

export interface Tournament {
  id: string;
  name: string;
  status: TournamentStatus;
  language: TournamentLanguage;
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
