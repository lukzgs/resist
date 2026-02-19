// Handlers para gerenciamento de timers do jogo

import type * as Party from "partykit/server";
import { GameState, Phase, TimerType, TimerConfig } from '../types';
import { addLog, getActivePlayers, getPlayerByConnection } from '../game/state';
import { log } from '../utils/logger';
import { GAME_RULES_BY_COUNT, MIN_MISSIONS_TO_WIN } from '../../../shared/constants';
import { getLeader } from '../../../shared/stateHelpers';

export interface TimerHandlerContext {
    room: Party.Room;
    gameState: GameState;
    connections: Map<string, string>;
    /** Map de timers ativos. Pertence à instância da sala (ResistServer), não a este módulo. */
    activeTimers: Map<string, NodeJS.Timeout>;
    sendError: (conn: Party.Connection, message: string) => void;
    broadcastState: () => void;
    scheduleRoomClosure: () => void;
}

/**
 * Inicia um timer para a fase atual
 */
export function startTimer(ctx: TimerHandlerContext, timerType: TimerType): void {
    const { timerConfig } = ctx.gameState;

    if (!timerConfig.enabled) return;

    // Cancela qualquer timer ativo
    cancelTimer(ctx);

    // Determina duração baseado no tipo
    let durationSeconds: number;
    switch (timerType) {
        case 'team_selection':
            durationSeconds = timerConfig.teamSelectionSeconds;
            break;
        case 'team_vote':
            durationSeconds = timerConfig.teamVoteSeconds;
            break;
        case 'mission_vote':
            durationSeconds = timerConfig.missionVoteSeconds;
            break;
    }

    const endsAt = Date.now() + durationSeconds * 1000;

    ctx.gameState.currentTimerEndsAt = endsAt;
    ctx.gameState.currentTimerType = timerType;

    // Agenda timeout no servidor para garantir consistência
    const timeout = setTimeout(() => {
        handleTimerExpired(ctx, timerType);
    }, durationSeconds * 1000);

    ctx.activeTimers.set(ctx.gameState.roomCode, timeout);
}

/**
 * Cancela o timer atual
 */
export function cancelTimer(ctx: TimerHandlerContext): void {
    const existingTimeout = ctx.activeTimers.get(ctx.gameState.roomCode);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
        ctx.activeTimers.delete(ctx.gameState.roomCode);
    }

    ctx.gameState.currentTimerEndsAt = undefined;
    ctx.gameState.currentTimerType = undefined;
}

/**
 * Pausa o timer atual e retorna tempo restante
 * Usado quando o jogo pausa por desconexão
 */
export function pauseTimer(ctx: TimerHandlerContext): { remainingMs: number; timerType: TimerType } | null {
    const { currentTimerEndsAt, currentTimerType } = ctx.gameState;

    if (!currentTimerEndsAt || !currentTimerType) {
        return null;
    }

    const remainingMs = Math.max(0, currentTimerEndsAt - Date.now());

    // Cancela o timeout do servidor
    const existingTimeout = ctx.activeTimers.get(ctx.gameState.roomCode);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
        ctx.activeTimers.delete(ctx.gameState.roomCode);
    }

    // Limpa estado do timer (cliente para de mostrar)
    ctx.gameState.currentTimerEndsAt = undefined;
    ctx.gameState.currentTimerType = undefined;

    return { remainingMs, timerType: currentTimerType };
}

/**
 * Retoma timer com tempo restante
 * Usado quando o jogo retoma após reconexão
 */
export function resumeTimer(ctx: TimerHandlerContext, remainingMs: number, timerType: TimerType): void {
    if (!ctx.gameState.timerConfig.enabled || remainingMs <= 0) {
        return;
    }

    // Cancela qualquer timer existente (por segurança)
    const existingTimeout = ctx.activeTimers.get(ctx.gameState.roomCode);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
        ctx.activeTimers.delete(ctx.gameState.roomCode);
    }

    // Define novo timestamp de expiração
    ctx.gameState.currentTimerEndsAt = Date.now() + remainingMs;
    ctx.gameState.currentTimerType = timerType;

    // Agenda timeout no servidor
    const timeout = setTimeout(() => {
        handleTimerExpired(ctx, timerType);
    }, remainingMs);

    ctx.activeTimers.set(ctx.gameState.roomCode, timeout);
}

/**
 * Processa expiração do timer
 */
export function handleTimerExpired(ctx: TimerHandlerContext, timerType: TimerType): void {
    // Limpa o timer
    ctx.activeTimers.delete(ctx.gameState.roomCode);
    ctx.gameState.currentTimerEndsAt = undefined;
    ctx.gameState.currentTimerType = undefined;

    switch (timerType) {
        case 'team_selection':
            handleTeamSelectionExpired(ctx);
            break;
        case 'team_vote':
            handleTeamVoteExpired(ctx);
            break;
        case 'mission_vote':
            handleMissionVoteExpired(ctx);
            break;
    }
}

/**
 * Timer de seleção de time expirou - passa para próximo líder
 */
function handleTeamSelectionExpired(ctx: TimerHandlerContext): void {
    if (ctx.gameState.phase !== Phase.TEAM_SELECTION) return;

    const activePlayers = getActivePlayers(ctx.gameState);
    const activePlayerIds = activePlayers.map(p => p.id);

    // Pega líder atual
    const currentLeader = getLeader(ctx.gameState);
    const currentLeaderActiveIndex = currentLeader ? activePlayerIds.indexOf(currentLeader.id) : -1;

    // Avança para próximo líder
    const nextLeaderActiveIndex = (currentLeaderActiveIndex + 1) % activePlayerIds.length;
    const nextLeaderId = activePlayerIds[nextLeaderActiveIndex];
    ctx.gameState.leaderIndex = ctx.gameState.players.findIndex(p => p.id === nextLeaderId);

    // Limpa time proposto
    ctx.gameState.proposedTeam = [];

    // Incrementa contador de rejeições (como se fosse uma rejeição)
    ctx.gameState.failedVoteCount++;

    const newLeader = getLeader(ctx.gameState);
    addLog(ctx.gameState, `> TEMPO ESGOTADO! Lideranca passou para ${newLeader.name}`);
    log.timer(ctx.gameState.roomCode, `Timer expirou (selecao) - lideranca passou para "${newLeader.name}"`);

    // Verifica limite de rejeições (regra dinâmica por pCount)
    const activePlayersCount = getActivePlayers(ctx.gameState).length;
    const maxRejections = GAME_RULES_BY_COUNT[activePlayersCount]?.maxRejections || 5;

    if (ctx.gameState.failedVoteCount >= maxRejections) {
        ctx.gameState.phase = Phase.GAME_OVER;
        ctx.gameState.winner = 'TERMINATOR' as any;
        addLog(ctx.gameState, `> TERMINATORS VENCEM - ${maxRejections} REJEIÇÕES`);
        ctx.scheduleRoomClosure();
    } else {
        // Inicia novo timer para o próximo líder
        startTimer(ctx, 'team_selection');
    }

    ctx.broadcastState();
}

/**
 * Timer de votação de time expirou - votos faltantes contam como aprovação
 */
function handleTeamVoteExpired(ctx: TimerHandlerContext): void {
    if (ctx.gameState.phase !== Phase.TEAM_VOTE) return;

    const missionIndex = ctx.gameState.currentMissionIndex;
    const mission = ctx.gameState.missions[missionIndex];
    const activePlayers = getActivePlayers(ctx.gameState);

    // Auto-aprovar votos faltantes
    let autoVotedCount = 0;
    for (const player of activePlayers) {
        if (!(player.id in mission.votes)) {
            ctx.gameState.missions[missionIndex].votes[player.id] = true;
            autoVotedCount++;
        }
    }

    if (autoVotedCount > 0) {
        addLog(ctx.gameState, `> TEMPO ESGOTADO! ${autoVotedCount} voto(s) automatico(s): Aprovar`);
        log.timer(ctx.gameState.roomCode, `Timer expirou (votacao) - ${autoVotedCount} voto(s) automatico(s) aplicados`);
    }

    // Processa resultado da votação
    const votes = Object.values(ctx.gameState.missions[missionIndex].votes);
    const approvals = votes.filter(v => v).length;
    const approved = approvals > activePlayers.length / 2;

    if (approved) {
        ctx.gameState.phase = Phase.MISSION_EXECUTION;
        ctx.gameState.failedVoteCount = 0;
        addLog(ctx.gameState, `> EQUIPE APROVADA (${approvals}/${activePlayers.length})`);

        // Inicia timer da missão se habilitado
        startTimer(ctx, 'mission_vote');
    } else {
        ctx.gameState.failedVoteCount++;
        addLog(ctx.gameState, `> EQUIPE REJEITADA (${approvals}/${activePlayers.length})`);

        const activePlayersCount = activePlayers.length;
        const maxRejections = GAME_RULES_BY_COUNT[activePlayersCount]?.maxRejections || 5;

        if (ctx.gameState.failedVoteCount >= maxRejections) {
            ctx.gameState.phase = Phase.GAME_OVER;
            ctx.gameState.winner = 'TERMINATOR' as any;
            addLog(ctx.gameState, `> TERMINATORS VENCEM - ${maxRejections} REJEIÇÕES`);
            ctx.scheduleRoomClosure();
        } else {
            ctx.gameState.phase = Phase.TEAM_SELECTION;
            const activePlayerIds = activePlayers.map(p => p.id);
            const currentLeader = getLeader(ctx.gameState);
            const currentLeaderActiveIndex = currentLeader ? activePlayerIds.indexOf(currentLeader.id) : -1;
            const nextLeaderActiveIndex = (currentLeaderActiveIndex + 1) % activePlayerIds.length;
            const nextLeaderId = activePlayerIds[nextLeaderActiveIndex];
            ctx.gameState.leaderIndex = ctx.gameState.players.findIndex(p => p.id === nextLeaderId);
            ctx.gameState.proposedTeam = [];
            ctx.gameState.missions[missionIndex].votes = {};

            // Inicia timer de seleção para próximo líder
            startTimer(ctx, 'team_selection');
        }
    }

    ctx.broadcastState();
}

/**
 * Timer de missão expirou - votos faltantes contam como sucesso
 */
function handleMissionVoteExpired(ctx: TimerHandlerContext): void {
    if (ctx.gameState.phase !== Phase.MISSION_EXECUTION) return;

    const missionIndex = ctx.gameState.currentMissionIndex;
    const mission = ctx.gameState.missions[missionIndex];

    // Auto-votar sucesso para quem não votou
    let autoVotedCount = 0;
    for (let i = 0; i < ctx.gameState.proposedTeam.length; i++) {
        if (mission.missionOutcomes[i] === undefined) {
            // Preenche outcomes vazios
            while (ctx.gameState.missions[missionIndex].missionOutcomes.length <= i) {
                ctx.gameState.missions[missionIndex].missionOutcomes.push(undefined as any);
            }
            ctx.gameState.missions[missionIndex].missionOutcomes[i] = true;
            autoVotedCount++;
        }
    }

    if (autoVotedCount > 0) {
        addLog(ctx.gameState, `> TEMPO ESGOTADO! ${autoVotedCount} voto(s) automatico(s): Sucesso`);
        log.timer(ctx.gameState.roomCode, `Timer expirou (missao) - ${autoVotedCount} acao(oes) automatica(s) aplicada(s)`);
    }

    // Processa resultado da missão
    const outcomes = ctx.gameState.missions[missionIndex].missionOutcomes.filter(o => o !== undefined);
    const fails = outcomes.filter(o => !o).length;
    const isFailed = mission.requiresTwoFails ? fails >= 2 : fails >= 1;

    ctx.gameState.missions[missionIndex].status = isFailed ? 'FAIL' : 'SUCCESS';
    addLog(ctx.gameState, `> MISSÃO ${missionIndex + 1}: ${isFailed ? 'FALHOU' : 'SUCESSO'} (${fails} sabotagem${fails !== 1 ? 's' : ''})`);

    const successes = ctx.gameState.missions.filter(m => m.status === 'SUCCESS').length;
    const failures = ctx.gameState.missions.filter(m => m.status === 'FAIL').length;

    if (successes >= MIN_MISSIONS_TO_WIN) {
        ctx.gameState.winner = 'HUMAN' as any;
        ctx.gameState.phase = Phase.GAME_OVER;
        addLog(ctx.gameState, `> RESISTÊNCIA VENCE!`);
        ctx.scheduleRoomClosure();
    } else if (failures >= MIN_MISSIONS_TO_WIN) {
        ctx.gameState.winner = 'TERMINATOR' as any;
        ctx.gameState.phase = Phase.GAME_OVER;
        addLog(ctx.gameState, `> SKYNET PREVALECE!`);
        ctx.scheduleRoomClosure();
    } else {
        // Próxima missão
        ctx.gameState.currentMissionIndex++;
        ctx.gameState.phase = Phase.TEAM_SELECTION;

        const activePlayers = getActivePlayers(ctx.gameState);
        const activePlayerIds = activePlayers.map(p => p.id);
        const currentLeader = getLeader(ctx.gameState);
        const currentLeaderActiveIndex = currentLeader ? activePlayerIds.indexOf(currentLeader.id) : -1;
        const nextLeaderActiveIndex = (currentLeaderActiveIndex + 1) % activePlayerIds.length;
        const nextLeaderId = activePlayerIds[nextLeaderActiveIndex];
        ctx.gameState.leaderIndex = ctx.gameState.players.findIndex(p => p.id === nextLeaderId);

        ctx.gameState.proposedTeam = [];

        // Inicia timer para seleção de time
        startTimer(ctx, 'team_selection');
    }

    ctx.broadcastState();
}

/**
 * Processa SET_TIMER_CONFIG
 */
export function handleSetTimerConfig(
    ctx: TimerHandlerContext,
    conn: Party.Connection,
    config: TimerConfig
): void {
    if (ctx.gameState.phase !== Phase.LOBBY) return;

    const player = getPlayerByConnection(ctx.gameState, ctx.connections, conn.id);
    if (!player?.isHost) {
        ctx.sendError(conn, 'Apenas o host pode configurar timers');
        return;
    }

    // Valida limites
    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

    ctx.gameState.timerConfig = {
        enabled: config.enabled,
        teamSelectionSeconds: clamp(config.teamSelectionSeconds, 30, 120),
        teamVoteSeconds: clamp(config.teamVoteSeconds, 30, 120),
        missionVoteSeconds: clamp(config.missionVoteSeconds, 30, 120),
    };

    if (config.enabled) {
        addLog(ctx.gameState, `> Timers habilitados`);
        log.timer(ctx.gameState.roomCode, 'Timers habilitados');
    } else {
        addLog(ctx.gameState, `> Timers desabilitados`);
        log.timer(ctx.gameState.roomCode, 'Timers desabilitados');
    }

    ctx.broadcastState();
}

/**
 * Limpa timers quando a sala é fechada
 * @param activeTimers Map de timers da instância do servidor
 */
export function cleanupTimers(activeTimers: Map<string, NodeJS.Timeout>, roomCode: string): void {
    const timeout = activeTimers.get(roomCode);
    if (timeout) {
        clearTimeout(timeout);
        activeTimers.delete(roomCode);
    }
}
