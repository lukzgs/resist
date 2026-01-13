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
import { generateRoomCode } from './utils/crypto';
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

    // Constantes de tempo - Sessão
    static readonly EMPTY_ROOM_CLEANUP_MS = 120000;  // 2 minutos
    static readonly RECONNECT_GRACE_PERIOD_MS = 300000;  // 5 minutos
    static readonly ROOM_EXPIRY_MS = 180000;  // 3 minutos
    static readonly DISCONNECT_WAIT_MS = 120000;  // 2 minutos
    static readonly DISCONNECT_VOTE_MS = 15000;  // 15 segundos
    static readonly MAX_DISCONNECT_ATTEMPTS = 3;

    // Constantes de tempo - Persistência/TTL
    static readonly TTL_LOBBY_EMPTY_MS = 5 * 60 * 1000;       // 5 min - lobby sem jogadores
    static readonly TTL_ALL_DISCONNECTED_MS = 10 * 60 * 1000; // 10 min - todos desconectados
    static readonly TTL_INACTIVE_MS = 30 * 60 * 1000;         // 30 min - sem ações com jogadores ativos
    static readonly TTL_MAX_DURATION_MS = 2 * 60 * 60 * 1000; // 2 horas - máximo de duração da sala

    // Rate limiting
    static readonly MAX_MESSAGES_PER_MINUTE = 30;
    private rateLimits: Map<string, { count: number; resetAt: number }> = new Map();

    constructor(public room: Party.Room) { }

    // ============================================================
    // PERSISTÊNCIA DE ESTADO
    // ============================================================

    /**
     * Chamado quando a sala inicia ou "acorda" da hibernação
     */
    async onStart(): Promise<void> {
        const saved = await this.room.storage.get<GameState>("gameState");
        if (saved) {
            // Verifica se o estado expirou
            const now = Date.now();
            const age = now - saved.createdAt;
            const inactive = now - saved.lastActivity;

            // Verifica TTL máximo (2 horas)
            if (age > ResistServer.TTL_MAX_DURATION_MS) {
                await this.clearStorage();
                return;
            }

            // Verifica inatividade (30 min sem ações)
            if (inactive > ResistServer.TTL_INACTIVE_MS) {
                await this.clearStorage();
                return;
            }

            this.gameState = saved;
            // Agenda próxima verificação
            await this.scheduleExpiration();
        }
    }

    /**
     * Salva estado no storage persistente
     */
    private async saveState(): Promise<void> {
        if (this.gameState) {
            await this.room.storage.put("gameState", this.gameState);
        }
    }

    /**
     * Limpa o storage e remove do registry
     */
    private async clearStorage(): Promise<void> {
        // Notifica registry antes de limpar
        if (this.gameState) {
            await this.notifyRegistry('unregister');
        }
        await this.room.storage.deleteAll();
        this.gameState = null;
    }

    /**
     * Agenda alarm para verificar expiração
     */
    private async scheduleExpiration(): Promise<void> {
        if (!this.gameState) return;

        const now = Date.now();
        const connCount = [...this.room.getConnections()].length;
        const playerCount = this.gameState.players.length;

        let ttl: number;

        if (playerCount === 0 || (this.gameState.phase === Phase.LOBBY && connCount === 0)) {
            // Lobby vazio: 5 min
            ttl = ResistServer.TTL_LOBBY_EMPTY_MS;
        } else if (connCount === 0) {
            // Todos desconectados durante jogo: 10 min
            ttl = ResistServer.TTL_ALL_DISCONNECTED_MS;
        } else {
            // Jogo ativo com jogadores: verifica inatividade (30 min)
            ttl = ResistServer.TTL_INACTIVE_MS;
        }

        await this.room.storage.setAlarm(now + ttl);
    }

    /**
     * Chamado quando o alarm dispara
     */
    async onAlarm(): Promise<void> {
        const now = Date.now();
        const connCount = [...this.room.getConnections()].length;

        // Se alguém conectado, re-agenda
        if (connCount > 0 && this.gameState) {
            const inactive = now - this.gameState.lastActivity;

            // Verifica inatividade
            if (inactive > ResistServer.TTL_INACTIVE_MS) {
                // Notifica e fecha
                this.room.broadcast(JSON.stringify({ type: 'ROOM_CLOSED' } as ServerMessage));
                await this.clearStorage();
                return;
            }

            // Verifica TTL máximo
            const age = now - this.gameState.createdAt;
            if (age > ResistServer.TTL_MAX_DURATION_MS) {
                this.room.broadcast(JSON.stringify({ type: 'ROOM_CLOSED' } as ServerMessage));
                await this.clearStorage();
                return;
            }

            // Re-agenda
            await this.scheduleExpiration();
        } else {
            // Ninguém conectado, limpa
            await this.clearStorage();
        }
    }

    /**
     * Atualiza timestamp de última atividade e salva estado
     */
    private async updateActivity(): Promise<void> {
        if (this.gameState) {
            this.gameState.lastActivity = Date.now();
            await this.saveState();
        }
    }

    /**
     * Notifica o registry sobre mudanças na sala
     */
    private async notifyRegistry(action: 'unregister' | 'update', data?: { playerCount?: number; phase?: string; isPublic?: boolean }): Promise<void> {
        if (!this.gameState) return;

        try {
            const registryUrl = `http://127.0.0.1:1999/parties/registry/main/${action}`;
            await fetch(registryUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: this.gameState.roomCode, ...data })
            });
        } catch (e) {
            // Falha silenciosa - registry pode não estar disponível
            console.warn('[Server] Falha ao notificar registry:', e);
        }
    }

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

        // Notifica registry sobre mudanças (playerCount, phase, isPublic)
        this.notifyRegistry('update', {
            playerCount: this.gameState.players.length,
            phase: this.gameState.phase,
            isPublic: this.gameState.isPublic
        });
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
            setGameState: (state: GameState) => { this.gameState = state; },
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
                    handleJoin(this.getJoinContext(), sender, data.name, data.avatarSeed, data.sessionId, data.isCreating);
                    break;
                }
                case 'LEAVE_ROOM':
                    handleLeaveRoom(this.getJoinContext(), sender);
                    break;
                case 'REMOVE_PLAYER':
                    if (this.gameState) handleRemovePlayer(this.getJoinContext(), sender, data.playerId);
                    break;
                case 'START_GAME':
                    if (this.gameState) handleStartGame(this.getGameContext(), sender);
                    break;
                case 'SELECT_PLAYER':
                    if (this.gameState) {
                        handleSelectPlayer(this.getGameContext(), sender, data.playerId);
                        this.updateActivity();  // Ação que avança o jogo
                    }
                    break;
                case 'SUBMIT_TEAM':
                    if (this.gameState) {
                        handleSubmitTeam(this.getGameContext(), sender);
                        this.updateActivity();  // Ação que avança o jogo
                    }
                    break;
                case 'VOTE':
                    if (this.gameState) {
                        handleVote(this.getGameContext(), sender, data.approve);
                        this.updateActivity();  // Ação que avança o jogo
                    }
                    break;
                case 'MISSION_ACTION':
                    if (this.gameState) {
                        handleMissionAction(this.getGameContext(), sender, data.success);
                        this.updateActivity();  // Ação que avança o jogo
                    }
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
                case 'SET_PUBLIC':
                    if (this.gameState && this.gameState.phase === Phase.LOBBY) {
                        // Apenas host pode alterar
                        const player = getPlayerByConnection(this.gameState, this.connections, sender.id);
                        if (player?.isHost) {
                            this.gameState.isPublic = data.enabled;
                            this.broadcastState();
                        }
                    }
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
        const url = new URL(req.url);
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Preflight CORS
        if (req.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        // GET /party/health - Health check
        if (req.method === 'GET') {
            return new Response(JSON.stringify({
                status: 'ok',
                timestamp: Date.now(),
                roomId: this.room.id
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        // POST /party/generate-code - Gera código de sala seguro
        if (req.method === 'POST' && url.pathname.endsWith('/generate-code')) {
            const code = generateRoomCode();
            return new Response(JSON.stringify({
                code,
                timestamp: Date.now()
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }
}
