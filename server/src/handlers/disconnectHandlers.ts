// Handlers para sistema de desconexão e votação

import type * as Party from "partykit/server";
import { GameState, Phase, Role, ServerMessage } from '../types';
import { addLog, getPlayerByConnection, getActivePlayers } from '../game/state';
import { log } from '../utils/logger';

export interface DisconnectHandlerContext {
    room: Party.Room;
    gameState: GameState;
    connections: Map<string, string>;
    disconnectedPlayers: Map<string, NodeJS.Timeout>;
    sendError: (conn: Party.Connection, message: string) => void;
    broadcastState: () => void;
    scheduleRoomClosure: () => void;
    cancelDisconnectTimers: () => void;
    startDisconnectWait: (player: { id: string; name: string }, attempt?: number) => void;
}

/**
 * Processa DISCONNECT_VOTE
 */
export function handleDisconnectVote(
    ctx: DisconnectHandlerContext,
    conn: Party.Connection,
    endGame: boolean
): void {
    if (ctx.gameState.phase !== Phase.DISCONNECT_VOTE) return;
    if (!ctx.gameState.disconnectVotes) return;

    const player = getPlayerByConnection(ctx.gameState, ctx.connections, conn.id);
    if (!player) return;

    // Não pode votar se está desconectado ou é espectador
    if (player.disconnected || player.isSpectator) return;

    // Já votou?
    if (player.id in ctx.gameState.disconnectVotes) return;

    ctx.gameState.disconnectVotes[player.id] = endGame;
    ctx.broadcastState();

    // Verifica se todos votaram
    const activePlayers = getActivePlayers(ctx.gameState);
    const voteCount = Object.keys(ctx.gameState.disconnectVotes).length;

    if (voteCount === activePlayers.length) {
        // Todos votaram - resolve externamente via timer
        // O timer do server.ts cuidará disso
    }
}

/**
 * Inicia espera de reconexão quando jogador desconecta
 */
export function startDisconnectWait(
    ctx: DisconnectHandlerContext,
    player: { id: string; name: string },
    attempt: number = 1,
    DISCONNECT_WAIT_MS: number
): void {
    ctx.cancelDisconnectTimers();

    const now = Date.now();
    const expiresAt = now + DISCONNECT_WAIT_MS;

    // Garante que não vamos salvar uma fase de transição da própria desconexão como sendo a fase do jogo
    // Se o jogo já estava pausado (ou em votação de quit), a fase verdadeira estava guardada no disconnectInfo anterior.
    const previousPhase = (ctx.gameState.phase === Phase.PAUSED_DISCONNECT || ctx.gameState.phase === Phase.DISCONNECT_VOTE) && ctx.gameState.disconnectInfo
        ? ctx.gameState.disconnectInfo.pausedPhase
        : ctx.gameState.phase;

    ctx.gameState.disconnectInfo = {
        disconnectedPlayerId: player.id,
        disconnectedPlayerName: player.name,
        pausedPhase: previousPhase,
        waitingAttempt: attempt,
        pausedAt: now,
        expiresAt,
    };
    ctx.gameState.phase = Phase.PAUSED_DISCONNECT;
    ctx.gameState.disconnectVotes = {};

    addLog(ctx.gameState, `> ${player.name} desconectou - aguardando ${DISCONNECT_WAIT_MS / 1000}s...`);
    log.disconnect(ctx.gameState.roomCode, `"${player.name}" desconectou - aguardando ${DISCONNECT_WAIT_MS / 1000}s (tentativa ${attempt})`);
    ctx.broadcastState();
}

/**
 * Cancela espera de reconexão (jogador reconectou)
 */
export function cancelDisconnectWait(ctx: DisconnectHandlerContext): void {
    if (!ctx.gameState.disconnectInfo) return;

    ctx.cancelDisconnectTimers();

    const info = ctx.gameState.disconnectInfo;
    ctx.gameState.phase = info.pausedPhase;
    ctx.gameState.disconnectInfo = undefined;
    ctx.gameState.disconnectVotes = undefined;

    addLog(ctx.gameState, `> Jogador reconectou - retomando jogo`);
    log.disconnect(ctx.gameState.roomCode, `"${info.disconnectedPlayerName}" reconectou - jogo retomado`);
    ctx.broadcastState();
}

/**
 * Inicia votação para decidir se encerra ou continua esperando
 */
export function startDisconnectVote(
    ctx: DisconnectHandlerContext,
    DISCONNECT_VOTE_MS: number
): void {
    if (!ctx.gameState.disconnectInfo) return;

    const expiresAt = Date.now() + DISCONNECT_VOTE_MS;

    ctx.gameState.phase = Phase.DISCONNECT_VOTE;
    ctx.gameState.disconnectInfo.expiresAt = expiresAt;
    ctx.gameState.disconnectVotes = {};

    addLog(ctx.gameState, `> Votacao: encerrar partida ou aguardar ${ctx.gameState.disconnectInfo.disconnectedPlayerName}?`);
    log.disconnect(ctx.gameState.roomCode, `Votacao de desconexao iniciada para "${ctx.gameState.disconnectInfo.disconnectedPlayerName}"`);
    ctx.broadcastState();
}

/**
 * Resolve votação de desconexão
 */
export function resolveDisconnectVote(
    ctx: DisconnectHandlerContext,
    MAX_DISCONNECT_ATTEMPTS: number
): 'END_GAME' | 'MAX_ATTEMPTS' | 'CONTINUE' {
    if (!ctx.gameState.disconnectInfo) return 'END_GAME';

    ctx.cancelDisconnectTimers();

    const info = ctx.gameState.disconnectInfo;
    const votes = ctx.gameState.disconnectVotes || {};
    const activePlayers = getActivePlayers(ctx.gameState);

    const endGameVotes = Object.values(votes).filter(v => v === true).length;
    const majorityNeeded = Math.ceil(activePlayers.length / 2);

    if (endGameVotes >= majorityNeeded) {
        return 'END_GAME';
    } else if (info.waitingAttempt >= MAX_DISCONNECT_ATTEMPTS) {
        return 'MAX_ATTEMPTS';
    } else {
        addLog(ctx.gameState, `> Jogadores votaram para aguardar - tentativa ${info.waitingAttempt + 1}/${MAX_DISCONNECT_ATTEMPTS}`);
        log.disconnect(ctx.gameState.roomCode, `Jogadores votaram aguardar - tentativa ${info.waitingAttempt + 1}/${MAX_DISCONNECT_ATTEMPTS}`);
        return 'CONTINUE';
    }
}

/**
 * Cancela partida (sem vencedor)
 */
export function cancelGame(ctx: DisconnectHandlerContext, reason: string): void {
    ctx.cancelDisconnectTimers();

    ctx.gameState.phase = Phase.GAME_OVER;
    ctx.gameState.winner = null;
    ctx.gameState.disconnectInfo = undefined;
    ctx.gameState.disconnectVotes = undefined;

    addLog(ctx.gameState, `> PARTIDA CANCELADA: ${reason}`);
    log.disconnect(ctx.gameState.roomCode, `Partida cancelada: ${reason}`);
    ctx.scheduleRoomClosure();
    ctx.broadcastState();
}
