import type * as Party from "partykit/server";
import {
    GameState,
    Phase,
    Role,
    ClientMessage,
    ServerMessage,
} from "./types";

// Importações dos módulos refatorados
import { createInitialState, getSanitizedState, addLog, getPlayerByConnection } from './game/state';
import {
    handleJoin,
    handleLeaveRoom,
    handleRemovePlayer,
    HandlerContext,
} from './handlers/joinHandler';
import {
    handleStartGame,
    handleSelectPlayer,
    handleSubmitTeam,
    handleVote,
    handleMissionAction,
    handleSetAnonymousVotes,
    handleSetShowRejectionCount,
    handleRestartGame,
    GameHandlerContext,
} from './handlers/gameHandlers';
import {
    handleDisconnectVote,
    startDisconnectWait as _startDisconnectWait,
    cancelDisconnectWait as _cancelDisconnectWait,
    startDisconnectVote as _startDisconnectVote,
    resolveDisconnectVote,
    cancelGame,
    DisconnectHandlerContext,
} from './handlers/disconnectHandlers';

export default class ResistServer implements Party.Server {
    // Estado do jogo
    gameState: GameState | null = null;

    // Mapa de conexões: connectionId -> playerId
    connections: Map<string, string> = new Map();

    // Mapa de jogadores desconectados pendentes de reconexão: playerId -> timeout
    disconnectedPlayers: Map<string, NodeJS.Timeout> = new Map();

    // Timer para fechar sala após GAME_OVER
    gameOverTimeout: NodeJS.Timeout | null = null;

    // Timer para espera de reconexão (sistema de votação)
    disconnectWaitTimer: NodeJS.Timeout | null = null;

    // Timer para votação de desconexão
    disconnectVoteTimer: NodeJS.Timeout | null = null;

    // Timer para limpeza da sala quando vazia
    roomCleanupTimeout: NodeJS.Timeout | null = null;

    // Constantes de tempo
    static readonly EMPTY_ROOM_CLEANUP_MS = 120000;  // 2 minutos
    static readonly RECONNECT_GRACE_PERIOD_MS = 300000;  // 5 minutos
    static readonly ROOM_EXPIRY_MS = 180000;  // 3 minutos
    static readonly DISCONNECT_WAIT_MS = 120000;  // 2 minutos
    static readonly DISCONNECT_VOTE_MS = 15000;  // 15 segundos
    static readonly MAX_DISCONNECT_ATTEMPTS = 3;

    // Rate limiting
    static readonly MAX_MESSAGES_PER_MINUTE = 30;
    private rateLimits: Map<string, { count: number; resetAt: number }> = new Map();

    constructor(public room: Party.Room) { }

    // ============================================================
    // GERENCIAMENTO DE TIMERS
    // ============================================================

    private scheduleRoomClosure = (): void => {
        if (this.gameOverTimeout) {
            clearTimeout(this.gameOverTimeout);
        }

        const expiresAt = Date.now() + ResistServer.ROOM_EXPIRY_MS;
        if (this.gameState) {
            this.gameState.roomExpiresAt = expiresAt;
        }

        this.gameOverTimeout = setTimeout(() => {
            this.room.broadcast(JSON.stringify({ type: 'ROOM_CLOSED' } as ServerMessage));
            for (const conn of this.room.getConnections()) {
                conn.close();
            }
            this.gameState = null;
            this.connections.clear();
            this.disconnectedPlayers.clear();
        }, ResistServer.ROOM_EXPIRY_MS);
    };

    private cancelRoomClosure = (): void => {
        if (this.gameOverTimeout) {
            clearTimeout(this.gameOverTimeout);
            this.gameOverTimeout = null;
        }
        if (this.gameState) {
            this.gameState.roomExpiresAt = undefined;
        }
    };

    private cancelDisconnectTimers = (): void => {
        if (this.disconnectWaitTimer) {
            clearTimeout(this.disconnectWaitTimer);
            this.disconnectWaitTimer = null;
        }
        if (this.disconnectVoteTimer) {
            clearTimeout(this.disconnectVoteTimer);
            this.disconnectVoteTimer = null;
        }
    };

    private cancelRoomCleanup = (): void => {
        if (this.roomCleanupTimeout) {
            clearTimeout(this.roomCleanupTimeout);
            this.roomCleanupTimeout = null;
        }
    };

    // ============================================================
    // SISTEMA DE DESCONEXÃO
    // ============================================================

    private startDisconnectWait = (player: { id: string; name: string }, attempt: number = 1): void => {
        if (!this.gameState) return;

        const ctx = this.getDisconnectContext();
        _startDisconnectWait(ctx, player, attempt, ResistServer.DISCONNECT_WAIT_MS);

        // Timer para iniciar votação
        this.disconnectWaitTimer = setTimeout(() => {
            this.startDisconnectVote();
        }, ResistServer.DISCONNECT_WAIT_MS);
    };

    private cancelDisconnectWait = (): void => {
        if (!this.gameState || !this.gameState.disconnectInfo) return;
        const ctx = this.getDisconnectContext();
        _cancelDisconnectWait(ctx);
    };

    private startDisconnectVote = (): void => {
        if (!this.gameState) return;
        const ctx = this.getDisconnectContext();
        _startDisconnectVote(ctx, ResistServer.DISCONNECT_VOTE_MS);

        this.disconnectVoteTimer = setTimeout(() => {
            this.resolveDisconnectVote();
        }, ResistServer.DISCONNECT_VOTE_MS);
    };

    private resolveDisconnectVote = (): void => {
        if (!this.gameState || !this.gameState.disconnectInfo) return;

        const ctx = this.getDisconnectContext();
        const result = resolveDisconnectVote(ctx, ResistServer.MAX_DISCONNECT_ATTEMPTS);

        const info = this.gameState.disconnectInfo;

        switch (result) {
            case 'END_GAME':
                cancelGame(ctx, `Jogadores votaram para encerrar (${info.disconnectedPlayerName} desconectou)`);
                break;
            case 'MAX_ATTEMPTS':
                cancelGame(ctx, `${info.disconnectedPlayerName} não reconectou após ${ResistServer.MAX_DISCONNECT_ATTEMPTS} tentativas`);
                break;
            case 'CONTINUE':
                const playerInfo = { id: info.disconnectedPlayerId, name: info.disconnectedPlayerName };
                this.startDisconnectWait(playerInfo, info.waitingAttempt + 1);
                break;
        }
    };

    // ============================================================
    // HELPERS
    // ============================================================

    private broadcastState = (): void => {
        if (!this.gameState) return;
        const message: ServerMessage = { type: 'STATE', state: getSanitizedState(this.gameState) };
        this.room.broadcast(JSON.stringify(message));
    };

    private sendError = (conn: Party.Connection, message: string): void => {
        const error: ServerMessage = { type: 'ERROR', message };
        conn.send(JSON.stringify(error));
    };

    private getJoinContext(): HandlerContext {
        return {
            room: this.room,
            gameState: this.gameState,
            connections: this.connections,
            disconnectedPlayers: this.disconnectedPlayers,
            sendError: this.sendError,
            broadcastState: this.broadcastState,
            cancelDisconnectWait: this.cancelDisconnectWait,
            createInitialState: createInitialState,
            cancelRoomCleanup: this.cancelRoomCleanup,
        };
    }

    private getGameContext(): GameHandlerContext {
        if (!this.gameState) throw new Error('No game state');
        return {
            room: this.room,
            gameState: this.gameState,
            connections: this.connections,
            sendError: this.sendError,
            broadcastState: this.broadcastState,
            scheduleRoomClosure: this.scheduleRoomClosure,
        };
    }

    private getDisconnectContext(): DisconnectHandlerContext {
        if (!this.gameState) throw new Error('No game state');
        return {
            room: this.room,
            gameState: this.gameState,
            connections: this.connections,
            disconnectedPlayers: this.disconnectedPlayers,
            sendError: this.sendError,
            broadcastState: this.broadcastState,
            scheduleRoomClosure: this.scheduleRoomClosure,
            cancelDisconnectTimers: this.cancelDisconnectTimers,
            startDisconnectWait: this.startDisconnectWait,
        };
    }

    // ============================================================
    // LIFECYCLE WebSocket
    // ============================================================

    onConnect(conn: Party.Connection, ctx: Party.ConnectionContext): void {
        if (this.gameState) {
            const message: ServerMessage = { type: 'STATE', state: getSanitizedState(this.gameState) };
            conn.send(JSON.stringify(message));
        }
    }

    onClose(conn: Party.Connection): void {
        const playerId = this.connections.get(conn.id);
        if (playerId && this.gameState) {
            const player = this.gameState.players.find(p => p.id === playerId);
            if (player) {
                player.disconnected = true;

                if (this.gameState.phase === Phase.LOBBY) {
                    this.broadcastState();
                    const lobbyTimeout = setTimeout(() => {
                        if (!this.gameState || this.gameState.phase !== Phase.LOBBY) return;

                        const playerStillDisconnected = this.gameState.players.find(
                            p => p.id === playerId && p.disconnected
                        );

                        if (playerStillDisconnected) {
                            this.gameState.players = this.gameState.players.filter(p => p.id !== playerId);
                            if (playerStillDisconnected.isHost && this.gameState.players.length > 0) {
                                this.gameState.players[0].isHost = true;
                                addLog(this.gameState, `> ${this.gameState.players[0].name} agora é o host`);
                            }
                            addLog(this.gameState, `> ${playerStillDisconnected.name} saiu da sala`);
                            this.broadcastState();
                        }
                    }, 3000);
                    this.disconnectedPlayers.set(playerId, lobbyTimeout);
                } else if (this.gameState.phase === Phase.GAME_OVER) {
                    this.broadcastState();
                } else if (this.gameState.phase === Phase.PAUSED_DISCONNECT || this.gameState.phase === Phase.DISCONNECT_VOTE) {
                    this.broadcastState();
                } else if (player.isSpectator) {
                    this.broadcastState();
                } else {
                    this.startDisconnectWait({ id: player.id, name: player.name });
                }
            }
        }

        this.connections.delete(conn.id);
        this.rateLimits.delete(conn.id);

        if (this.connections.size === 0 && !this.roomCleanupTimeout) {
            this.roomCleanupTimeout = setTimeout(() => {
                if (this.connections.size === 0) {
                    if (this.gameOverTimeout) {
                        clearTimeout(this.gameOverTimeout);
                        this.gameOverTimeout = null;
                    }
                    this.cancelDisconnectTimers();
                    for (const timeout of this.disconnectedPlayers.values()) {
                        clearTimeout(timeout);
                    }
                    this.disconnectedPlayers.clear();
                    this.gameState = null;
                }
                this.roomCleanupTimeout = null;
            }, ResistServer.EMPTY_ROOM_CLEANUP_MS);
        }
    }

    onMessage(message: string, sender: Party.Connection): void {
        // Rate limiting
        const now = Date.now();
        const limit = this.rateLimits.get(sender.id);

        if (limit && now < limit.resetAt) {
            if (limit.count >= ResistServer.MAX_MESSAGES_PER_MINUTE) {
                this.sendError(sender, 'Muitas requisições. Aguarde um momento.');
                return;
            }
            limit.count++;
        } else {
            this.rateLimits.set(sender.id, { count: 1, resetAt: now + 60000 });
        }

        try {
            const data: ClientMessage = JSON.parse(message);

            switch (data.type) {
                case 'JOIN': {
                    const ctx = this.getJoinContext();
                    handleJoin(ctx, sender, data.name, data.avatarSeed, data.sessionId, data.isCreating);
                    // Atualiza referência do gameState após JOIN (pode ter sido criado)
                    if (ctx.gameState) this.gameState = ctx.gameState;
                    break;
                }
                case 'LEAVE_ROOM':
                    handleLeaveRoom(this.getJoinContext(), sender);
                    break;
                case 'REMOVE_PLAYER':
                    if (this.gameState) handleRemovePlayer(this.getJoinContext(), sender);
                    break;
                case 'START_GAME':
                    if (this.gameState) handleStartGame(this.getGameContext(), sender);
                    break;
                case 'SELECT_PLAYER':
                    if (this.gameState) handleSelectPlayer(this.getGameContext(), sender, data.playerId);
                    break;
                case 'SUBMIT_TEAM':
                    if (this.gameState) handleSubmitTeam(this.getGameContext(), sender);
                    break;
                case 'VOTE':
                    if (this.gameState) handleVote(this.getGameContext(), sender, data.approve);
                    break;
                case 'MISSION_ACTION':
                    if (this.gameState) handleMissionAction(this.getGameContext(), sender, data.success);
                    break;
                case 'SET_ANONYMOUS_VOTES':
                    if (this.gameState) handleSetAnonymousVotes(this.getGameContext(), sender, data.enabled);
                    break;
                case 'SET_SHOW_REJECTION_COUNT':
                    if (this.gameState) handleSetShowRejectionCount(this.getGameContext(), sender, data.enabled);
                    break;
                case 'RESTART_GAME':
                    if (this.gameState) handleRestartGame(this.getGameContext(), sender, this.cancelRoomClosure);
                    break;
                case 'DISCONNECT_VOTE':
                    if (this.gameState) handleDisconnectVote(this.getDisconnectContext(), sender, data.endGame);
                    break;
            }
        } catch (e) {
            const errorType = e instanceof SyntaxError ? 'JSON inválido' :
                e instanceof TypeError ? 'Tipo inválido' : 'Erro desconhecido';
            console.error(`[${this.room.id}] Erro ao processar mensagem (${errorType}):`, e instanceof Error ? e.message : e);
            this.sendError(sender, `Erro ao processar mensagem: ${errorType}`);
        }
    }

    async onRequest(req: Party.Request): Promise<Response> {
        if (req.method === 'GET') {
            return new Response(JSON.stringify({
                status: 'ok',
                timestamp: Date.now(),
                roomId: this.room.id
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        return new Response('Method not allowed', { status: 405 });
    }
}
