// Handlers para ações do jogo

import type * as Party from "partykit/server";
import { GameState, Phase, Role, Player, ServerMessage, TimerType } from '../types';
import { GAME_RULES_BY_COUNT } from '../../../shared/constants';
import { getLeader, getCurrentMission } from '../../../shared/stateHelpers';
import { shuffle } from '../utils/crypto';
import { addLog, getSanitizedState, getPlayerByConnection, getActivePlayers } from '../game/state';
import { log } from '../utils/logger';

export interface GameHandlerContext {
    room: Party.Room;
    gameState: GameState;
    connections: Map<string, string>;
    sendError: (conn: Party.Connection, message: string) => void;
    broadcastState: () => void;
    scheduleRoomClosure: () => void;
    startTimer?: (timerType: TimerType) => void;
    cancelTimer?: () => void;
}

/**
 * Verifica se jogador pode realizar ações (não é espectador)
 */
function isActivePlayer(
    ctx: GameHandlerContext,
    conn: Party.Connection
): Player | null {
    const player = getPlayerByConnection(ctx.gameState, ctx.connections, conn.id);
    if (!player) return null;
    if (player.isSpectator) {
        ctx.sendError(conn, 'Espectadores não podem interagir no jogo');
        return null;
    }
    return player;
}

/**
 * Processa START_GAME
 */
export function handleStartGame(ctx: GameHandlerContext, conn: Party.Connection): void {
    if (ctx.gameState.phase !== Phase.LOBBY) return;

    const player = getPlayerByConnection(ctx.gameState, ctx.connections, conn.id);
    if (!player?.isHost) {
        ctx.sendError(conn, 'Apenas o host pode iniciar');
        return;
    }

    const activePlayers = getActivePlayers(ctx.gameState);
    const pCount = activePlayers.length;

    if (pCount < 5 || pCount > 10) {
        ctx.sendError(conn, `Precisa de 5-10 jogadores conectados (atual: ${pCount})`);
        return;
    }

    const rules = GAME_RULES_BY_COUNT[pCount];

    // Distribui papéis
    const roles: Role[] = [];
    for (let i = 0; i < rules.spyCount; i++) roles.push(Role.TERMINATOR);
    for (let i = 0; i < pCount - rules.spyCount; i++) roles.push(Role.HUMAN);
    const shuffledRoles = shuffle(roles);

    // Atribui papéis apenas aos jogadores ativos
    let roleIndex = 0;
    ctx.gameState.players = ctx.gameState.players.map((p) => {
        if (p.isSpectator || p.disconnected) {
            return p;
        }
        return { ...p, role: shuffledRoles[roleIndex++] };
    });

    // Cria missões
    ctx.gameState.missions = rules.missionSizes.map((size, i) => ({
        roundNumber: i + 1,
        requiredPlayers: size,
        requiresTwoFails: !!((rules.twoFailsRequiredRound4 && i === 3) || (rules.twoFailsRequiredRound5 && i === 4)),
        status: 'PENDING' as const,
        team: [],
        votes: {},
        missionOutcomes: [],
    }));

    // Configura estado inicial
    ctx.gameState.phase = Phase.TEAM_SELECTION;
    ctx.gameState.leaderIndex = Math.floor(Math.random() * pCount);
    ctx.gameState.currentMissionIndex = 0;
    ctx.gameState.failedVoteCount = 0;
    ctx.gameState.proposedTeam = [];

    addLog(ctx.gameState, `> UNIDADE FORMADA: ${pCount} AGENTES`);
    addLog(ctx.gameState, `> ESCANEANDO ASSINATURAS...`);

    const terminatorCount = ctx.gameState.players.filter(p => p.role === Role.TERMINATOR).length;
    log.game(ctx.gameState.roomCode, `Jogo iniciado - ${pCount} jogadores, ${terminatorCount} terminators`);

    // Inicia timer de selecao de time se habilitado
    if (ctx.gameState.timerConfig.enabled && ctx.startTimer) {
        ctx.startTimer('team_selection');
    }

    ctx.broadcastState();
}

/**
 * Processa SELECT_PLAYER
 */
export function handleSelectPlayer(ctx: GameHandlerContext, conn: Party.Connection, playerId: string): void {
    if (ctx.gameState.phase !== Phase.TEAM_SELECTION) return;

    const player = isActivePlayer(ctx, conn);
    if (!player) return;

    const leader = getLeader(ctx.gameState);
    if (player.id !== leader.id) {
        ctx.sendError(conn, 'Apenas o líder pode selecionar');
        return;
    }

    if (!ctx.gameState.players.some(p => p.id === playerId)) {
        ctx.sendError(conn, 'Jogador não encontrado');
        return;
    }

    const currentMission = getCurrentMission(ctx.gameState);
    const team = ctx.gameState.proposedTeam;

    if (team.includes(playerId)) {
        ctx.gameState.proposedTeam = team.filter(id => id !== playerId);
    } else if (team.length < currentMission.requiredPlayers) {
        ctx.gameState.proposedTeam = [...team, playerId];
    }

    ctx.broadcastState();
}

/**
 * Processa SUBMIT_TEAM
 */
export function handleSubmitTeam(ctx: GameHandlerContext, conn: Party.Connection): void {
    if (ctx.gameState.phase !== Phase.TEAM_SELECTION) return;

    const player = isActivePlayer(ctx, conn);
    if (!player) return;

    const leader = getLeader(ctx.gameState);
    if (player.id !== leader.id) {
        ctx.sendError(conn, 'Apenas o líder pode submeter');
        return;
    }

    const currentMission = getCurrentMission(ctx.gameState);
    if (ctx.gameState.proposedTeam.length !== currentMission.requiredPlayers) {
        ctx.sendError(conn, `Selecione exatamente ${currentMission.requiredPlayers} jogadores`);
        return;
    }

    getCurrentMission(ctx.gameState).votes = {};
    ctx.gameState.phase = Phase.TEAM_VOTE;
    addLog(ctx.gameState, `> ESQUADRAO PROPOSTO PELO COMANDANTE`);

    const teamNames = ctx.gameState.proposedTeam.map(id => {
        const p = ctx.gameState.players.find(pl => pl.id === id);
        return p ? `"${p.name}"` : id;
    }).join(', ');
    log.game(ctx.gameState.roomCode, `Missao ${ctx.gameState.currentMissionIndex + 1} - equipe submetida: ${teamNames}`);

    // Cancela timer de seleção e inicia timer de votação se habilitado
    if (ctx.gameState.timerConfig.enabled) {
        if (ctx.cancelTimer) ctx.cancelTimer();
        if (ctx.startTimer) ctx.startTimer('team_vote');
    }

    ctx.broadcastState();
}

/**
 * Processa VOTE
 */
export function handleVote(ctx: GameHandlerContext, conn: Party.Connection, approve: boolean): void {
    if (ctx.gameState.phase !== Phase.TEAM_VOTE) return;

    const player = isActivePlayer(ctx, conn);
    if (!player) return;

    const missionIndex = ctx.gameState.currentMissionIndex;
    const mission = ctx.gameState.missions[missionIndex];

    if (player.id in mission.votes) return;

    ctx.gameState.missions[missionIndex].votes[player.id] = approve;

    const activePlayers = getActivePlayers(ctx.gameState);
    if (Object.keys(ctx.gameState.missions[missionIndex].votes).length === activePlayers.length) {
        const votes = Object.values(ctx.gameState.missions[missionIndex].votes);
        const approvals = votes.filter(v => v).length;
        const approved = approvals > activePlayers.length / 2;

        // Cancela timer de votação
        if (ctx.gameState.timerConfig.enabled && ctx.cancelTimer) {
            ctx.cancelTimer();
        }

        ctx.broadcastState();

        setTimeout(() => {
            if (approved) {
                ctx.gameState.phase = Phase.MISSION_EXECUTION;
                ctx.gameState.failedVoteCount = 0;
                addLog(ctx.gameState, `> EQUIPE APROVADA (${approvals}/${activePlayers.length})`);
                log.game(ctx.gameState.roomCode, `Missao ${missionIndex + 1} - equipe aprovada (${approvals}/${activePlayers.length})`);

                // Inicia timer de missão se habilitado
                if (ctx.gameState.timerConfig.enabled && ctx.startTimer) {
                    ctx.startTimer('mission_vote');
                }
            } else {
                ctx.gameState.failedVoteCount++;
                addLog(ctx.gameState, `> EQUIPE REJEITADA (${approvals}/${activePlayers.length})`);
                log.game(ctx.gameState.roomCode, `Missao ${missionIndex + 1} - equipe rejeitada (${approvals}/${activePlayers.length}) - rejeicao ${ctx.gameState.failedVoteCount}`);

                const rules = GAME_RULES_BY_COUNT[activePlayers.length];
                const maxRejections = rules?.maxRejections || 5;

                if (ctx.gameState.failedVoteCount >= maxRejections) {
                    // LIMITE DE REJEIÇÕES ATINGIDO: Missão falha mas o jogo continua
                    ctx.gameState.missions[missionIndex].status = 'FAIL';
                    addLog(ctx.gameState, `> MISSAO ${missionIndex + 1} FALHOU (LIMITE DE REJEICOES)`);
                    log.game(ctx.gameState.roomCode, `Missao ${missionIndex + 1} falhou por excesso de rejeicoes (${maxRejections})`);

                    const failures = ctx.gameState.missions.filter(m => m.status === 'FAIL').length;

                    if (failures >= 3) {
                        ctx.gameState.phase = Phase.GAME_OVER;
                        ctx.gameState.winner = Role.TERMINATOR;
                        addLog(ctx.gameState, `> TERMINATORS VENCEM O JOGO!`);
                        log.game(ctx.gameState.roomCode, 'Terminators vencem o jogo por 3 falhas');
                        ctx.scheduleRoomClosure();
                    } else {
                        // O jogo continua, avança para a próxima missão
                        ctx.gameState.currentMissionIndex++;
                        ctx.gameState.phase = Phase.TEAM_SELECTION;
                        ctx.gameState.failedVoteCount = 0;

                        // Passa a liderança para o próximo jogador ativo
                        const activePlayerIds = activePlayers.map(p => p.id);
                        const currentLeader = getLeader(ctx.gameState);
                        const currentLeaderActiveIndex = currentLeader ? activePlayerIds.indexOf(currentLeader.id) : -1;
                        const nextLeaderActiveIndex = (currentLeaderActiveIndex + 1) % activePlayerIds.length;
                        const nextLeaderId = activePlayerIds[nextLeaderActiveIndex];
                        ctx.gameState.leaderIndex = ctx.gameState.players.findIndex(p => p.id === nextLeaderId);

                        ctx.gameState.proposedTeam = [];

                        if (ctx.gameState.timerConfig.enabled && ctx.startTimer) {
                            ctx.startTimer('team_selection');
                        }
                    }
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

                    // Inicia timer de seleção para próximo líder se habilitado
                    if (ctx.gameState.timerConfig.enabled && ctx.startTimer) {
                        ctx.startTimer('team_selection');
                    }
                }
            }

            ctx.broadcastState();
        }, 750);

        return;
    }

    ctx.broadcastState();
}

/**
 * Processa MISSION_ACTION
 */
export function handleMissionAction(ctx: GameHandlerContext, conn: Party.Connection, success: boolean): void {
    if (ctx.gameState.phase !== Phase.MISSION_EXECUTION) return;

    const player = isActivePlayer(ctx, conn);
    if (!player) return;

    if (!ctx.gameState.proposedTeam.includes(player.id)) {
        ctx.sendError(conn, 'Você não está na equipe');
        return;
    }

    const missionIndex = ctx.gameState.currentMissionIndex;
    const mission = ctx.gameState.missions[missionIndex];

    const teamIndex = ctx.gameState.proposedTeam.indexOf(player.id);
    if (mission.missionOutcomes[teamIndex] !== undefined) return;

    const outcome = player.role === Role.HUMAN ? true : success;

    while (ctx.gameState.missions[missionIndex].missionOutcomes.length <= teamIndex) {
        ctx.gameState.missions[missionIndex].missionOutcomes.push(undefined as any);
    }
    ctx.gameState.missions[missionIndex].missionOutcomes[teamIndex] = outcome;

    const outcomes = ctx.gameState.missions[missionIndex].missionOutcomes.filter(o => o !== undefined);
    if (outcomes.length === mission.requiredPlayers) {
        const fails = outcomes.filter(o => !o).length;
        const isFailed = mission.requiresTwoFails ? fails >= 2 : fails >= 1;

        // Cancela timer de missão
        if (ctx.gameState.timerConfig.enabled && ctx.cancelTimer) {
            ctx.cancelTimer();
        }

        ctx.gameState.missions[missionIndex].status = isFailed ? 'FAIL' : 'SUCCESS';
        addLog(ctx.gameState, `> MISSAO ${missionIndex + 1}: ${isFailed ? 'FALHOU' : 'SUCESSO'} (${fails} sabotagem${fails !== 1 ? 's' : ''})`);
        log.game(ctx.gameState.roomCode, `Missao ${missionIndex + 1} - ${isFailed ? 'FALHOU' : 'SUCESSO'} (${fails} sabotagem${fails !== 1 ? 's' : ''})`);

        const successes = ctx.gameState.missions.filter(m => m.status === 'SUCCESS').length;
        const failures = ctx.gameState.missions.filter(m => m.status === 'FAIL').length;

        if (successes >= 3) {
            ctx.gameState.winner = Role.HUMAN;
            ctx.gameState.phase = Phase.GAME_OVER;
            addLog(ctx.gameState, `> RESISTENCIA VENCE!`);
            log.game(ctx.gameState.roomCode, 'FIM - Resistencia vence!');
            ctx.scheduleRoomClosure();
        } else if (failures >= 3) {
            ctx.gameState.winner = Role.TERMINATOR;
            ctx.gameState.phase = Phase.GAME_OVER;
            addLog(ctx.gameState, `> SKYNET PREVALECE!`);
            log.game(ctx.gameState.roomCode, 'FIM - Skynet prevalece!');
            ctx.scheduleRoomClosure();
        } else {
            ctx.broadcastState();

            setTimeout(() => {
                ctx.gameState.currentMissionIndex++;
                ctx.gameState.phase = Phase.TEAM_SELECTION;

                // Calcula próximo líder apenas entre jogadores ativos
                const activePlayers = getActivePlayers(ctx.gameState);
                const activePlayerIds = activePlayers.map(p => p.id);
                const currentLeader = getLeader(ctx.gameState);
                const currentLeaderActiveIndex = currentLeader ? activePlayerIds.indexOf(currentLeader.id) : -1;
                const nextLeaderActiveIndex = (currentLeaderActiveIndex + 1) % activePlayerIds.length;
                const nextLeaderId = activePlayerIds[nextLeaderActiveIndex];
                ctx.gameState.leaderIndex = ctx.gameState.players.findIndex(p => p.id === nextLeaderId);

                ctx.gameState.proposedTeam = [];

                // Inicia timer de seleção para próxima missão se habilitado
                if (ctx.gameState.timerConfig.enabled && ctx.startTimer) {
                    ctx.startTimer('team_selection');
                }

                ctx.broadcastState();
            }, 500);

            return;
        }
    }

    ctx.broadcastState();
}

/**
 * Processa SET_ANONYMOUS_VOTES
 */
export function handleSetAnonymousVotes(ctx: GameHandlerContext, conn: Party.Connection, enabled: boolean): void {
    if (ctx.gameState.phase !== Phase.LOBBY) return;

    const player = getPlayerByConnection(ctx.gameState, ctx.connections, conn.id);
    if (!player?.isHost) return;

    ctx.gameState.anonymousVotes = enabled;
    addLog(ctx.gameState, `> Votos ${enabled ? 'anonimos' : 'publicos'}`);
    log.system(ctx.gameState.roomCode, `Votos anonimos: ${enabled ? 'ativado' : 'desativado'}`);
    ctx.broadcastState();
}

/**
 * Processa SET_SHOW_REJECTION_COUNT
 */
export function handleSetShowRejectionCount(ctx: GameHandlerContext, conn: Party.Connection, enabled: boolean): void {
    if (ctx.gameState.phase !== Phase.LOBBY) return;

    const player = getPlayerByConnection(ctx.gameState, ctx.connections, conn.id);
    if (!player?.isHost) return;

    ctx.gameState.showRejectionCount = enabled;
    addLog(ctx.gameState, `> Contagem de rejeicoes ${enabled ? 'ativada' : 'desativada'}`);
    log.system(ctx.gameState.roomCode, `Contagem de rejeicoes: ${enabled ? 'ativada' : 'desativada'}`);
    ctx.broadcastState();
}

/**
 * Processa RESTART_GAME
 */
export function handleRestartGame(
    ctx: GameHandlerContext,
    conn: Party.Connection,
    cancelRoomClosure: () => void
): void {
    if (ctx.gameState.phase !== Phase.GAME_OVER) return;

    const player = getPlayerByConnection(ctx.gameState, ctx.connections, conn.id);
    if (!player?.isHost) {
        ctx.sendError(conn, 'Apenas o host pode reiniciar o jogo');
        return;
    }

    cancelRoomClosure();

    ctx.gameState.phase = Phase.LOBBY;
    ctx.gameState.winner = null;
    ctx.gameState.leaderIndex = 0;
    ctx.gameState.currentMissionIndex = 0;
    ctx.gameState.missions = [];
    ctx.gameState.failedVoteCount = 0;
    ctx.gameState.proposedTeam = [];

    ctx.gameState.players = ctx.gameState.players.map(p => ({
        ...p,
        role: Role.HUMAN,
        isSpectator: false,
        disconnected: false,
    }));

    addLog(ctx.gameState, `> NOVA PARTIDA INICIADA`);
    log.game(ctx.gameState.roomCode, 'Nova partida iniciada');
    ctx.broadcastState();
}
