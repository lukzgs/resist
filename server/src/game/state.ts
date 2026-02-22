// Gerenciamento de estado do jogo

import { GameState, Phase, Player, Role } from '../types';
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
export function getSanitizedState(state: GameState, targetPlayerId?: string): GameState {
    const isGameOver = state.phase === Phase.GAME_OVER;

    const sanitizedState: GameState = {
        ...state,
        players: state.players.map((p, index) => {
            const isMe = p.id === targetPlayerId;

            // Determina a Role para enviar. Oculta se for alheia (a menos que seja GameOver ou os dois Terminators)
            let safeRole = p.role;
            if (!isMe && !isGameOver) {
                const targetPlayer = state.players.find(tp => tp.id === targetPlayerId);
                const amITerminator = targetPlayer?.role === Role.TERMINATOR;
                const isHeTerminator = p.role === Role.TERMINATOR;

                if (!(amITerminator && isHeTerminator)) {
                    safeRole = 'UNKNOWN' as Role;
                }
            }

            // Centraliza o cálculo de "hasVoted" no backend
            let hasVoted = false;
            if (state.phase === Phase.TEAM_VOTE) {
                const currentMission = state.missions[state.currentMissionIndex];
                hasVoted = currentMission?.votes[p.id] !== undefined;
            } else if (state.phase === Phase.MISSION_EXECUTION) {
                const currentMission = state.missions[state.currentMissionIndex];
                const teamIndex = state.proposedTeam.indexOf(p.id);
                if (teamIndex !== -1 && currentMission?.missionOutcomes) {
                    hasVoted = typeof currentMission.missionOutcomes[teamIndex] === 'boolean';
                }
            }

            return {
                ...p,
                role: safeRole,
                hasVoted,
                sessionId: undefined
            };
        }),
        missions: state.missions.map((mission, index) => {
            // Clona a missão para não mutar o estado original
            const sanitizedMission = { ...mission, missionOutcomes: [...mission.missionOutcomes] };

            // Se for TEAM_VOTE de missão anônima: Esconda os votos alheios no dicionário literal
            if (state.phase === Phase.TEAM_VOTE && state.anonymousVotes && index === state.currentMissionIndex) {
                sanitizedMission.votes = {};
                if (mission.votes[targetPlayerId!]) { // Envie apenas o prórpio voto para UI
                    sanitizedMission.votes[targetPlayerId!] = mission.votes[targetPlayerId!];
                }
            }

            if (index === state.currentMissionIndex && state.phase === Phase.MISSION_EXECUTION) {
                // Durante a votação: oculta o verdeiro valor do voto.
                // Criamos um novo array denso para evitar que o .map pule empty slots
                const outcomes = [];
                for (let i = 0; i < mission.requiredPlayers; i++) {
                    const outcome = mission.missionOutcomes[i];
                    // O valor *real* de outcome será boolean (true/false) se o jogador votou
                    outcomes.push(typeof outcome === 'boolean' ? (true as any) : null);
                }
                sanitizedMission.missionOutcomes = outcomes;
            } else if (mission.status !== 'PENDING') {
                // Após a votação: embaralha os votos para que não seja possível saber QUEM votou o quê
                sanitizedMission.missionOutcomes = shuffle([...mission.missionOutcomes]);

                // Anonimiza os votos finais se aplicável (impedindo leitura do log da aba rede de history passados)
                if (state.anonymousVotes) {
                    sanitizedMission.votes = {};
                }
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
