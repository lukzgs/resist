export enum Role {
  RESISTANCE = 'RESISTANCE',
  SPY = 'SPY',
}

export enum Phase {
  HOME = 'HOME',
  LOBBY = 'LOBBY',
  TEAM_SELECTION = 'TEAM_SELECTION',
  TEAM_VOTE = 'TEAM_VOTE',
  MISSION_EXECUTION = 'MISSION_EXECUTION',
  GAME_OVER = 'GAME_OVER',
}

export interface Player {
  id: string;
  peerId?: string; // Para conexões P2P
  name: string;
  role: Role;
  isAi: boolean;
  isHost: boolean;
  avatarSeed: number;
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
  isProcessingAi: boolean;
}

export interface GameConfig {
  playerCount: number;
  spyCount: number;
  missionSizes: number[];
  twoFailsRequiredRound4?: boolean;
}
