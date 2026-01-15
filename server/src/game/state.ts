// Gerenciamento de estado do jogo

import { GameState, Phase, Player } from '../types';

/**
 * Cria estado inicial do jogo
 */
export function createInitialState(roomCode: string, roomName: string = '', isPublic: boolean = true): GameState {
    const now = Date.now();
    return {
        phase: Phase.LOBBY,
        players: [],
        roomCode,
        roomName: roomName || `Sala ${roomCode}`,  // Default: "Sala XXXX"
        leaderIndex: 0,
        currentMissionIndex: 0,
        missions: [],
        failedVoteCount: 0,
        proposedTeam: [],
        logs: [`> PROTOCOLO: ${roomCode}`],
        winner: null,
        anonymousVotes: true,
        showRejectionCount: true,
        createdAt: now,
        lastActivity: now,
        isPublic,
        timerConfig: {
            enabled: false,
            teamSelectionSeconds: 60,
            teamVoteSeconds: 45,
            missionVoteSeconds: 30,
        },
    };
}

/**
 * Retorna estado sanitizado (sem sessionIds) para enviar aos clientes
 */
export function getSanitizedState(state: GameState): GameState {
    return {
        ...state,
        players: state.players.map(p => ({
            ...p,
            sessionId: undefined
        }))
    };
}

/**
 * Adiciona log ao estado (mantém últimos 20)
 */
export function addLog(state: GameState, message: string): void {
    state.logs = [...state.logs.slice(-20), message];
}

/**
 * Sanitiza nome: apenas letras e números, máximo 10 caracteres
 */
export function sanitizeName(name: string): string {
    return (name || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
}

/**
 * Encontra jogador pelo ID da conexão
 */
export function getPlayerByConnection(
    state: GameState,
    connections: Map<string, string>,
    connId: string
): Player | undefined {
    const playerId = connections.get(connId);
    return state.players.find(p => p.id === playerId);
}

/**
 * Conta jogadores ativos (não espectadores e conectados)
 */
export function getActivePlayers(state: GameState): Player[] {
    return state.players.filter(p => !p.isSpectator && !p.disconnected);
}
