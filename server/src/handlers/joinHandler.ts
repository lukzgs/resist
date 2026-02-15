// Handlers para JOIN e gerenciamento de jogadores

import type * as Party from "partykit/server";
import { GameState, Phase, Role, Player, ServerMessage } from '../types';
import { generateId, generateUUID } from '../utils/crypto';
import { addLog, getSanitizedState, sanitizeName, getPlayerByConnection } from '../game/state';
import { log } from '../utils/logger';

export interface HandlerContext {
    room: Party.Room;
    gameState: GameState | null;
    connections: Map<string, string>;
    disconnectedPlayers: Map<string, NodeJS.Timeout>;
    sendError: (conn: Party.Connection, message: string) => void;
    broadcastState: () => void;
    cancelDisconnectWait: () => void;
    cancelGracePeriod: (playerId: string) => void;  // Cancela grace period se jogador reconectar
    createInitialState: (roomCode: string) => GameState;
    cancelRoomCleanup: () => void;
    setGameState: (state: GameState) => void;  // Para criar novo estado
}

/**
 * Processa JOIN - entrada de jogador na sala
 */
export function handleJoin(
    ctx: HandlerContext,
    conn: Party.Connection,
    name: string,
    avatarSeed: number,
    sessionId?: string,
    isCreating?: boolean,
    roomName?: string
): void {
    // Sanitiza e valida o nome
    const sanitizedName = sanitizeName(name);
    if (sanitizedName.length < 1) {
        ctx.sendError(conn, 'Nome inválido: deve conter pelo menos 1 caractere alfanumérico');
        return;
    }
    name = sanitizedName;

    // Cancela timeout de limpeza da sala
    ctx.cancelRoomCleanup();

    // Se está tentando entrar em sala inexistente sem sessionId
    const roomIsEmpty = !ctx.gameState || ctx.gameState.players.length === 0;
    if (!isCreating && roomIsEmpty && !sessionId) {
        ctx.sendError(conn, 'Sala não encontrada');
        setTimeout(() => conn.close(), 100);
        return;
    }

    // Inicializa estado se necessário
    if (!ctx.gameState) {
        const newState = ctx.createInitialState(ctx.room.id);
        if (roomName) {
            newState.roomName = roomName;
        }
        ctx.setGameState(newState);
        ctx.gameState = newState;
        log.player(ctx.room.id, `Sala criada${roomName ? ` "${roomName}"` : ''}`);
    }

    // Verifica se já está conectado com esta conexão
    if (ctx.connections.has(conn.id)) {
        const message: ServerMessage = { type: 'STATE', state: getSanitizedState(ctx.gameState) };
        conn.send(JSON.stringify(message));
        return;
    }

    // Tenta reconexão por sessionId
    const existingPlayer = sessionId
        ? ctx.gameState.players.find(p => p.sessionId === sessionId)
        : null;

    if (existingPlayer) {
        handleReconnect(ctx, conn, existingPlayer, name);
        return;
    }

    // Verifica limites
    const activePlayersCount = ctx.gameState.players.filter(p => !p.isSpectator).length;
    const totalCount = ctx.gameState.players.length;
    const isGameInProgress = ctx.gameState.phase !== Phase.LOBBY;

    if (!isGameInProgress && activePlayersCount >= 10) {
        ctx.sendError(conn, 'Sala cheia (máximo 10 jogadores)');
        return;
    }

    if (totalCount >= 15) {
        ctx.sendError(conn, 'Sala cheia (máximo 15 participantes)');
        return;
    }

    // Cria novo jogador
    const newSessionId = generateUUID();
    const isFirstPlayer = ctx.gameState.players.length === 0;
    const newPlayer: Player = {
        id: generateId(),
        name,
        role: Role.HUMAN,
        isHost: isFirstPlayer && !isGameInProgress,
        avatarSeed,
        sessionId: newSessionId,
        disconnected: false,
        isSpectator: isGameInProgress,
    };

    // Envia confirmação de sessão
    try {
        conn.send(JSON.stringify({
            type: 'SESSION_ESTABLISHED',
            sessionId: newSessionId,
            playerId: newPlayer.id
        } as ServerMessage));
    } catch (e) {
        log.error(ctx.gameState.roomCode, 'Erro ao enviar SESSION_ESTABLISHED', e);
    }

    // Registra e adiciona jogador
    ctx.connections.set(conn.id, newPlayer.id);
    ctx.gameState.players.push(newPlayer);
    addLog(ctx.gameState, `> ${name} conectou`);

    const playerCount = ctx.gameState.players.filter(p => !p.isSpectator).length;
    if (newPlayer.isSpectator) {
        log.player(ctx.gameState.roomCode, `"${name}" entrou como espectador`);
    } else {
        log.player(ctx.gameState.roomCode, `"${name}" entrou na sala (${playerCount}/10)`);
    }

    ctx.broadcastState();

    // Envia estado explicitamente para o novo jogador
    const stateMsg: ServerMessage = { type: 'STATE', state: getSanitizedState(ctx.gameState) };
    conn.send(JSON.stringify(stateMsg));

    // Notifica entrada
    ctx.room.broadcast(JSON.stringify({ type: 'PLAYER_JOINED', name } as ServerMessage));
}

/**
 * Handler de reconexão
 */
function handleReconnect(
    ctx: HandlerContext,
    conn: Party.Connection,
    existingPlayer: Player,
    name: string
): void {
    if (!ctx.gameState) return;

    // Cancela timeout de remoção
    const timeout = ctx.disconnectedPlayers.get(existingPlayer.id);
    if (timeout) {
        clearTimeout(timeout);
        ctx.disconnectedPlayers.delete(existingPlayer.id);
    }

    // Cancela grace period se estava aguardando
    ctx.cancelGracePeriod(existingPlayer.id);

    // Registra nova conexão
    ctx.connections.set(conn.id, existingPlayer.id);

    // Atualiza nome apenas no lobby
    if (existingPlayer.name !== name && ctx.gameState.phase === Phase.LOBBY) {
        addLog(ctx.gameState, `> ${existingPlayer.name} agora é ${name}`);
        log.player(ctx.gameState.roomCode, `"${existingPlayer.name}" mudou nome para "${name}"`);
        existingPlayer.name = name;
    }

    existingPlayer.disconnected = false;

    // Se era o jogador que causou pausa, cancela espera
    if (ctx.gameState.disconnectInfo?.disconnectedPlayerId === existingPlayer.id) {
        ctx.cancelDisconnectWait();
        log.player(ctx.gameState.roomCode, `"${existingPlayer.name}" reconectou - jogo retomado`);
    } else {
        addLog(ctx.gameState, `> ${existingPlayer.name} reconectou`);
        log.player(ctx.gameState.roomCode, `"${existingPlayer.name}" reconectou`);
        ctx.broadcastState();
    }

    // Envia estado atual
    const message: ServerMessage = { type: 'STATE', state: getSanitizedState(ctx.gameState) };
    conn.send(JSON.stringify(message));
}

/**
 * Processa LEAVE_ROOM - saída voluntária
 */
export function handleLeaveRoom(ctx: HandlerContext, conn: Party.Connection): void {
    if (!ctx.gameState) return;

    const playerId = ctx.connections.get(conn.id);
    if (!playerId) return;

    const playerIndex = ctx.gameState.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;

    const player = ctx.gameState.players[playerIndex];

    // Cancela timeout pendente
    const timeout = ctx.disconnectedPlayers.get(playerId);
    if (timeout) {
        clearTimeout(timeout);
        ctx.disconnectedPlayers.delete(playerId);
    }

    // Remove jogador
    ctx.gameState.players.splice(playerIndex, 1);
    ctx.connections.delete(conn.id);

    // Passa host se necessário
    if (player.isHost && ctx.gameState.players.length > 0) {
        ctx.gameState.players[0].isHost = true;
        addLog(ctx.gameState, `> ${ctx.gameState.players[0].name} agora é o host`);
        log.player(ctx.gameState.roomCode, `"${ctx.gameState.players[0].name}" assumiu como host`);
    }

    addLog(ctx.gameState, `> ${player.name} saiu da sala`);
    const remainingCount = ctx.gameState.players.filter(p => !p.isSpectator).length;
    log.player(ctx.gameState.roomCode, `"${player.name}" saiu da sala (${remainingCount}/10)`);
    ctx.broadcastState();
    conn.close();
}

/**
 * Processa REMOVE_PLAYER (host remove jogador específico)
 */
export function handleRemovePlayer(ctx: HandlerContext, conn: Party.Connection, playerId: string): void {
    if (!ctx.gameState || ctx.gameState.phase !== Phase.LOBBY) return;

    const requestingPlayer = getPlayerByConnection(ctx.gameState, ctx.connections, conn.id);
    if (!requestingPlayer?.isHost) {
        ctx.sendError(conn, 'Apenas o host pode remover jogadores');
        return;
    }

    // Não pode remover a si mesmo
    if (requestingPlayer.id === playerId) {
        ctx.sendError(conn, 'Você não pode remover a si mesmo');
        return;
    }

    const playerIndex = ctx.gameState.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
        ctx.sendError(conn, 'Jogador não encontrado');
        return;
    }

    const removed = ctx.gameState.players[playerIndex];
    ctx.gameState.players.splice(playerIndex, 1);

    // Encontra e fecha a conexão do jogador removido
    for (const [connId, pId] of ctx.connections.entries()) {
        if (pId === playerId) {
            ctx.connections.delete(connId);
            // Encontra a conexão e notifica/fecha
            for (const c of ctx.room.getConnections()) {
                if (c.id === connId) {
                    try {
                        // Envia mensagem de kick antes de fechar
                        c.send(JSON.stringify({
                            type: 'ERROR',
                            message: 'Você foi removido da sala pelo host'
                        } as ServerMessage));
                    } catch (e) {
                        // Ignora erro de envio
                    }
                    // Fecha a conexão com código custom 4001 (kicked)
                    // Delay para garantir que a mensagem ERROR chegue antes do close
                    setTimeout(() => c.close(4001, 'kicked'), 100);
                    break;
                }
            }
            break;
        }
    }

    addLog(ctx.gameState, `> ${removed.name} removido pelo host`);
    log.player(ctx.gameState.roomCode, `"${removed.name}" removido pelo host`);
    ctx.broadcastState();
}
