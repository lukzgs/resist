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
    isSpectator?: boolean;   // true se é espectador (entrou após jogo começar)
    hasVoted?: boolean;      // (Apenas UI) Server informa se o jogador já votou/agiu na fase atual
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
    // Timer pausado (se havia um ativo)
    pausedTimerRemainingMs?: number;
    pausedTimerType?: TimerType;
}

// Configuração de timers do jogo
export interface TimerConfig {
    enabled: boolean;
    teamSelectionSeconds: number;   // 30-120
    teamVoteSeconds: number;        // 30-120
    missionVoteSeconds: number;     // 30-120
}

// Tipo de timer ativo
export type TimerType = 'team_selection' | 'team_vote' | 'mission_vote';

export interface GameState {
    phase: Phase;
    players: Player[];
    roomCode: string;
    roomName: string;         // Nome personalizado da sala
    leaderIndex: number;
    currentMissionIndex: number;
    missions: Mission[];
    failedVoteCount: number;
    proposedTeam: string[];
    logs: string[];
    winner: Role | null;
    anonymousVotes: boolean;  // Se true, votos não mostram quem votou o quê
    showRejectionCount: boolean;  // Se true, mostra contagem de rejeições ao fim da missão
    roomExpiresAt?: number;   // Timestamp de quando a sala fecha (após GAME_OVER)
    disconnectInfo?: DisconnectInfo;  // Info de desconexão durante jogo
    disconnectVotes?: Record<string, boolean>;  // playerId -> true=encerrar
    createdAt: number;        // Timestamp de criação da sala
    lastActivity: number;     // Timestamp da última ação do jogo (voto, missão, etc.)
    isPublic: boolean;        // Se true, sala aparece na lista pública
    timerConfig: TimerConfig; // Configuração de timers
    currentTimerEndsAt?: number;    // Timestamp de quando o timer atual expira
    currentTimerType?: TimerType;   // Tipo do timer ativo
}

// Mensagens do cliente para o servidor
export type ClientMessage =
    | { type: 'JOIN'; name: string; avatarSeed: number; sessionId?: string; isCreating?: boolean; roomName?: string }
    | { type: 'LEAVE_ROOM' }
    | { type: 'REMOVE_PLAYER'; playerId: string }
    | { type: 'START_GAME'; timerConfig?: TimerConfig }
    | { type: 'SELECT_PLAYER'; playerId: string }
    | { type: 'SUBMIT_TEAM' }
    | { type: 'VOTE'; approve: boolean }
    | { type: 'MISSION_ACTION'; success: boolean }
    | { type: 'SET_ANONYMOUS_VOTES'; enabled: boolean }
    | { type: 'SET_SHOW_REJECTION_COUNT'; enabled: boolean }
    | { type: 'SET_PUBLIC'; enabled: boolean }
    | { type: 'RESTART_GAME' }
    | { type: 'DISCONNECT_VOTE'; endGame: boolean }
    | { type: 'TOGGLE_SPECTATOR'; playerId?: string }
    | { type: 'TRANSFER_HOST'; playerId: string };

// Mensagens do servidor para o cliente
export type ServerMessage =
    | { type: 'STATE'; state: GameState }
    | { type: 'ERROR'; message: string }
    | { type: 'PLAYER_JOINED'; name: string }
    | { type: 'PLAYER_LEFT'; name: string }
    | { type: 'ROOM_CLOSED' }
    | { type: 'SESSION_ESTABLISHED'; sessionId: string; playerId: string };

// Configuração de regras do jogo
export interface GameRules {
    spyCount: number;
    missionSizes: number[];
    maxRejections: number;
    twoFailsRequiredRound4?: boolean;
    twoFailsRequiredRound5?: boolean;
}
