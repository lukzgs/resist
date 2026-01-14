// Handlers para ações do jogo

import type * as Party from "partykit/server";
import { GameState, Phase, Role, Player, ServerMessage, GAME_RULES } from '../types';
import { shuffle } from '../utils/crypto';
import { addLog, getSanitizedState, getPlayerByConnection, getActivePlayers } from '../game/state';

export interface GameHandlerContext {
    room: Party.Room;
    gameState: GameState;
    connections: Map<string, string>;
    sendError: (conn: Party.Connection, message: string) => void;
    broadcastState: () => void;
    scheduleRoomClosure: () => void;
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

    const rules = GAME_RULES[pCount];

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
    ctx.broadcastState();
}

/**
 * Processa SELECT_PLAYER
 */
export function handleSelectPlayer(ctx: GameHandlerContext, conn: Party.Connection, playerId: string): void {
    if (ctx.gameState.phase !== Phase.TEAM_SELECTION) return;

    const player = isActivePlayer(ctx, conn);
    if (!player) return;

    const leader = ctx.gameState.players[ctx.gameState.leaderIndex];
    if (player.id !== leader.id) {
        ctx.sendError(conn, 'Apenas o líder pode selecionar');
        return;
    }

    if (!ctx.gameState.players.some(p => p.id === playerId)) {
        ctx.sendError(conn, 'Jogador não encontrado');
        return;
    }

    const currentMission = ctx.gameState.missions[ctx.gameState.currentMissionIndex];
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

    const leader = ctx.gameState.players[ctx.gameState.leaderIndex];
    if (player.id !== leader.id) {
        ctx.sendError(conn, 'Apenas o líder pode submeter');
        return;
    }

    const currentMission = ctx.gameState.missions[ctx.gameState.currentMissionIndex];
    if (ctx.gameState.proposedTeam.length !== currentMission.requiredPlayers) {
        ctx.sendError(conn, `Selecione exatamente ${currentMission.requiredPlayers} jogadores`);
        return;
    }

    ctx.gameState.missions[ctx.gameState.currentMissionIndex].votes = {};
    ctx.gameState.phase = Phase.TEAM_VOTE;
    addLog(ctx.gameState, `> ESQUADRÃO PROPOSTO PELO COMANDANTE`);
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

        ctx.broadcastState();

        setTimeout(() => {
            if (approved) {
                ctx.gameState.phase = Phase.MISSION_EXECUTION;
                ctx.gameState.failedVoteCount = 0;
                addLog(ctx.gameState, `> EQUIPE APROVADA (${approvals}/${activePlayers.length})`);
            } else {
                ctx.gameState.failedVoteCount++;
                addLog(ctx.gameState, `> EQUIPE REJEITADA (${approvals}/${activePlayers.length})`);

                if (ctx.gameState.failedVoteCount >= 5) {
                    ctx.gameState.phase = Phase.GAME_OVER;
                    ctx.gameState.winner = Role.TERMINATOR;
                    addLog(ctx.gameState, `> TERMINATORS VENCEM - 5 REJEIÇÕES`);
                    ctx.scheduleRoomClosure();
                } else {
                    ctx.gameState.phase = Phase.TEAM_SELECTION;
                    const activePlayerIds = activePlayers.map(p => p.id);
                    const currentLeaderId = ctx.gameState.players[ctx.gameState.leaderIndex].id;
                    const currentLeaderActiveIndex = activePlayerIds.indexOf(currentLeaderId);
                    const nextLeaderActiveIndex = (currentLeaderActiveIndex + 1) % activePlayerIds.length;
                    const nextLeaderId = activePlayerIds[nextLeaderActiveIndex];
                    ctx.gameState.leaderIndex = ctx.gameState.players.findIndex(p => p.id === nextLeaderId);
                    ctx.gameState.proposedTeam = [];
                    ctx.gameState.missions[missionIndex].votes = {};
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

        ctx.gameState.missions[missionIndex].status = isFailed ? 'FAIL' : 'SUCCESS';
        addLog(ctx.gameState, `> MISSÃO ${missionIndex + 1}: ${isFailed ? 'FALHOU' : 'SUCESSO'} (${fails} sabotagem${fails !== 1 ? 's' : ''})`);

        const successes = ctx.gameState.missions.filter(m => m.status === 'SUCCESS').length;
        const failures = ctx.gameState.missions.filter(m => m.status === 'FAIL').length;

        if (successes >= 3) {
            ctx.gameState.winner = Role.HUMAN;
            ctx.gameState.phase = Phase.GAME_OVER;
            addLog(ctx.gameState, `> RESISTÊNCIA VENCE!`);
            ctx.scheduleRoomClosure();
        } else if (failures >= 3) {
            ctx.gameState.winner = Role.TERMINATOR;
            ctx.gameState.phase = Phase.GAME_OVER;
            addLog(ctx.gameState, `> SKYNET PREVALECE!`);
            ctx.scheduleRoomClosure();
        } else {
            ctx.broadcastState();

            setTimeout(() => {
                ctx.gameState.currentMissionIndex++;
                ctx.gameState.phase = Phase.TEAM_SELECTION;
                ctx.gameState.leaderIndex = (ctx.gameState.leaderIndex + 1) % ctx.gameState.players.length;
                ctx.gameState.proposedTeam = [];
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
    addLog(ctx.gameState, `> Votos ${enabled ? 'anônimos' : 'públicos'}`);
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
    addLog(ctx.gameState, `> Contagem de rejeições ${enabled ? 'ativada' : 'desativada'}`);
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
    ctx.broadcastState();
}
