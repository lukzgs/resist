
export enum Role {
  HUMAN = 'HUMAN',
  TERMINATOR = 'TERMINATOR',
}

export enum Phase {
  LOBBY = 'LOBBY',
  TEAM_SELECTION = 'TEAM_SELECTION',
  TEAM_VOTE = 'TEAM_VOTE',
  MISSION_EXECUTION = 'MISSION_EXECUTION',
  GAME_OVER = 'GAME_OVER',
  PAUSED_DISCONNECT = 'PAUSED_DISCONNECT',  // Jogo pausado aguardando reconexão
  DISCONNECT_VOTE = 'DISCONNECT_VOTE',      // Votação para encerrar ou esperar
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  isHost: boolean;
  avatarSeed: number;
  sessionId?: string;      // ID persistente para reconexão
  disconnected?: boolean;  // true se jogador está offline
  isBot?: boolean;         // true se é um bot
}

export interface Mission {
  roundNumber: number;
  requiredPlayers: number;
  requiresTwoFails: boolean;
  status: 'PENDING' | 'SUCCESS' | 'FAIL';
  team: string[];
  votes: Record<string, boolean>;
  missionOutcomes: boolean[];
}

export interface GameConfig {
  playerCount: number;
  spyCount: number;
  missionSizes: number[];
  twoFailsRequiredRound4?: boolean;
}

// Informações de desconexão durante o jogo
export interface DisconnectInfo {
  disconnectedPlayerId: string;
  disconnectedPlayerName: string;
  pausedPhase: Phase;           // Fase anterior para retornar
  waitingAttempt: number;       // 1, 2 ou 3
  pausedAt: number;             // Timestamp de quando pausou
  expiresAt: number;            // Quando timer expira
}

export interface GameState {
  phase: Phase;
  players: Player[];
  roomCode: string;
  leaderIndex: number;
  currentMissionIndex: number;
  missions: Mission[];
  failedVoteCount: number;
  proposedTeam: string[];
  logs: string[];
  winner: Role | null;
  anonymousVotes: boolean;  // Se true, votos não mostram quem votou o quê
  roomExpiresAt?: number;   // Timestamp de quando a sala fecha (após GAME_OVER)
  disconnectInfo?: DisconnectInfo;  // Info de desconexão durante jogo
  disconnectVotes?: Record<string, boolean>;  // playerId -> true=encerrar
}