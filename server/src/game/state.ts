// Gerenciamento de estado do jogo

import { GameState, Phase, Player } from '../types';
import { shuffle } from '../utils/crypto';

/** Configuração padrão de timer */
const DEFAULT_TIMER_CONFIG = {
    enabled: true,
    teamSelectionSeconds: 120,
    teamVoteSeconds: 45,
    missionVoteSeconds: 30,
} as const;

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
        logs: [],
        winner: null,
        anonymousVotes: true,
        showRejectionCount: true,
        createdAt: now,
        lastActivity: now,
        isPublic,
        timerConfig: { ...DEFAULT_TIMER_CONFIG },
    };
}

/**
 * Retorna estado sanitizado (sem sessionIds) para enviar aos clientes
 */
export function getSanitizedState(state: GameState): GameState {
    const sanitizedState: GameState = {
        ...state,
        players: state.players.map(p => ({
            ...p,
            sessionId: undefined
        })),
        missions: state.missions.map((mission, index) => {
            // Clona a missão para não mutar o estado original
            const sanitizedMission = { ...mission, missionOutcomes: [...mission.missionOutcomes] };

            if (index === state.currentMissionIndex && state.phase === Phase.MISSION_EXECUTION) {
                // Durante a votação: oculta o verdeiro valor do voto. Se votou, vira true genérico.
                sanitizedMission.missionOutcomes = sanitizedMission.missionOutcomes.map(outcome =>
                    outcome !== undefined ? (true as any) : undefined
                );
            } else if (mission.status !== 'PENDING') {
                // Após a votação: embaralha os votos para que não seja possível saber QUEM votou o quê
                sanitizedMission.missionOutcomes = shuffle([...mission.missionOutcomes]);
            }

            return sanitizedMission;
        })
    };

    return sanitizedState;
}

/**
 * Adiciona log ao estado (mantém últimos 20)
 */
export function addLog(state: GameState, message: string): void {
    // Logs desabilitados - para reativar, remova o return abaixo
    return;
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
