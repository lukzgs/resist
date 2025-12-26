// Tipos compartilhados entre servidor e cliente

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

// Mensagens do cliente para o servidor
export type ClientMessage =
    | { type: 'JOIN'; name: string; avatarSeed: number; sessionId?: string }
    | { type: 'REMOVE_PLAYER' }
    | { type: 'START_GAME' }
    | { type: 'SELECT_PLAYER'; playerId: string }
    | { type: 'SUBMIT_TEAM' }
    | { type: 'VOTE'; approve: boolean }
    | { type: 'MISSION_ACTION'; success: boolean }
    | { type: 'SET_ANONYMOUS_VOTES'; enabled: boolean }
    | { type: 'RESTART_GAME' }
    | { type: 'DISCONNECT_VOTE'; endGame: boolean };

// Mensagens do servidor para o cliente
export type ServerMessage =
    | { type: 'STATE'; state: GameState }
    | { type: 'ERROR'; message: string }
    | { type: 'PLAYER_JOINED'; name: string }
    | { type: 'PLAYER_LEFT'; name: string }
    | { type: 'ROOM_CLOSED' };

// Regras do jogo por número de jogadores
export const GAME_RULES: Record<number, { spyCount: number; missionSizes: number[]; twoFailsRequiredRound4?: boolean }> = {
    5: { spyCount: 2, missionSizes: [2, 3, 2, 3, 3] },
    6: { spyCount: 2, missionSizes: [2, 3, 4, 3, 4] },
    7: { spyCount: 3, missionSizes: [2, 3, 3, 4, 4], twoFailsRequiredRound4: true },
    8: { spyCount: 3, missionSizes: [3, 4, 4, 5, 5], twoFailsRequiredRound4: true },
    9: { spyCount: 3, missionSizes: [3, 4, 4, 5, 5], twoFailsRequiredRound4: true },
    10: { spyCount: 4, missionSizes: [3, 4, 4, 5, 5], twoFailsRequiredRound4: true },
};
