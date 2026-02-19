import type * as Party from "partykit/server";
import {
    GameState,
    Phase,
    Role,
    ClientMessage,
    ServerMessage,
} from "./types";

// Importações dos módulos refatorados
import { createInitialState, getSanitizedState, addLog } from './game/state';
import { log } from './utils/logger';
import { generateRoomCode } from './utils/crypto';
import {
    HandlerContext,
} from './handlers/joinHandler';
import {
    GameHandlerContext,
} from './handlers/gameHandlers';
import {
    startDisconnectWait as _startDisconnectWait,
    cancelDisconnectWait as _cancelDisconnectWait,
    startDisconnectVote as _startDisconnectVote,
    resolveDisconnectVote,
    cancelGame,
    DisconnectHandlerContext,
} from './handlers/disconnectHandlers';
import { dispatchMessage, ServerContexts } from './handlers/messageRouter';
import {
    handleSetTimerConfig,
    startTimer,
    cancelTimer,
    pauseTimer,
    resumeTimer,
    cleanupTimers,
    TimerHandlerContext,
} from './handlers/timerHandlers';

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

    // Timers de grace period para reconexão rápida (antes de pausar o jogo)
    gracePeriodTimers: Map<string, NodeJS.Timeout> = new Map();

    // Timers de fases do jogo (team selection, voting, mission)
    // IMPORTANTE: deve ficar aqui na classe (não no módulo timerHandlers) para evitar
    // vazamento de memória quando múltiplas salas existem no mesmo worker.
    activeTimers: Map<string, NodeJS.Timeout> = new Map();

    // Constantes de tempo - Sessão
    static readonly EMPTY_ROOM_CLEANUP_MS = 120000;  // 2 minutos
    static readonly RECONNECT_GRACE_PERIOD_MS = 300000;  // 5 minutos
    static readonly ROOM_EXPIRY_MS = 180000;  // 3 minutos
    static readonly DISCONNECT_WAIT_MS = 120000;  // 2 minutos
    static readonly DISCONNECT_VOTE_MS = 15000;  // 15 segundos
    static readonly DISCONNECT_GRACE_PERIOD_MS = 25000;  // 25 segundos - tempo antes de pausar o jogo
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
            // Em produção, usamos o stub para comunicação interna
            // @ts-ignore - Property 'parties' does exist on Room
            const registry = this.room.context.parties.get("registry", "main");

            await registry.fetch(`/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: this.gameState.roomCode, ...data })
            });
        } catch (e) {
            // Se falhar o stub, tenta via URL pública (fallback para dev local se necessário)
            try {
                const host = (this.room.env.PARTYKIT_HOST as string) || '127.0.0.1:1999';
                const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
                const registryUrl = `${protocol}://${host}/parties/registry/main/${action}`;

                await fetch(registryUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: this.gameState.roomCode, ...data })
                });
            } catch (e2) {
                log.warn(this.gameState?.roomCode || '', 'Falha ao notificar registry (stub e fallback)');
            }
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

        // Pausa o timer do jogo antes de começar a espera
        const timerCtx = this.getTimerContext();
        const pausedTimerInfo = pauseTimer(timerCtx);

        const ctx = this.getDisconnectContext();
        _startDisconnectWait(ctx, player, attempt, ResistServer.DISCONNECT_WAIT_MS);

        // Salva informações do timer pausado
        if (pausedTimerInfo && this.gameState.disconnectInfo) {
            this.gameState.disconnectInfo.pausedTimerRemainingMs = pausedTimerInfo.remainingMs;
            this.gameState.disconnectInfo.pausedTimerType = pausedTimerInfo.timerType;
        }

        // Timer para iniciar votação
        this.disconnectWaitTimer = setTimeout(() => {
            this.startDisconnectVote();
        }, ResistServer.DISCONNECT_WAIT_MS);
    };

    private cancelDisconnectWait = (): void => {
        if (!this.gameState || !this.gameState.disconnectInfo) return;

        // Guarda informações do timer pausado antes de limpar disconnectInfo
        const pausedRemainingMs = this.gameState.disconnectInfo.pausedTimerRemainingMs;
        const pausedTimerType = this.gameState.disconnectInfo.pausedTimerType;

        const ctx = this.getDisconnectContext();
        _cancelDisconnectWait(ctx);

        // Retoma o timer se havia um pausado
        if (pausedRemainingMs && pausedTimerType && this.gameState.timerConfig.enabled) {
            const timerCtx = this.getTimerContext();
            resumeTimer(timerCtx, pausedRemainingMs, pausedTimerType);
            this.broadcastState();
        }
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
        const playerCount = this.gameState.players.length;
        log.system(this.gameState.roomCode, `Broadcast state - ${playerCount} jogadores, fase ${this.gameState.phase}`);

        if (playerCount === 0) {
            // Sala vazia: remove do registry para não aparecer como sala fantasma
            log.system(this.gameState.roomCode, 'Sala vazia - removendo do registry');
            this.notifyRegistry('unregister');
        } else {
            this.notifyRegistry('update', {
                playerCount,
                phase: this.gameState.phase,
                isPublic: this.gameState.isPublic
            });
        }
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
            cancelGracePeriod: (playerId: string) => {
                const timer = this.gracePeriodTimers.get(playerId);
                if (timer) {
                    clearTimeout(timer);
                    this.gracePeriodTimers.delete(playerId);
                    log.player(this.gameState!.roomCode, `"${playerId}" reconectou durante grace period`);
                }
            },
            createInitialState: createInitialState,
            cancelRoomCleanup: this.cancelRoomCleanup,
            setGameState: (state: GameState) => { this.gameState = state; },
        };
    }

    private getGameContext(): GameHandlerContext {
        if (!this.gameState) throw new Error('No game state');
        const timerCtx = this.getTimerContext();
        return {
            room: this.room,
            gameState: this.gameState,
            connections: this.connections,
            sendError: this.sendError,
            broadcastState: this.broadcastState,
            scheduleRoomClosure: this.scheduleRoomClosure,
            startTimer: (timerType) => startTimer(timerCtx, timerType),
            cancelTimer: () => cancelTimer(timerCtx),
        };
    }

    private getTimerContext(): TimerHandlerContext {
        if (!this.gameState) throw new Error('No game state');
        return {
            room: this.room,
            gameState: this.gameState,
            connections: this.connections,
            activeTimers: this.activeTimers,
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

    private getServerContexts(): ServerContexts {
        return {
            getJoinContext: () => this.getJoinContext(),
            getGameContext: () => this.getGameContext(),
            getDisconnectContext: () => this.getDisconnectContext(),
            hasGameState: () => this.gameState !== null,
            updateActivity: () => this.updateActivity(),
            cancelRoomClosure: this.cancelRoomClosure,
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
                    // Grace period: espera 25s antes de pausar o jogo
                    // Se jogador reconectar nesse tempo, jogo continua normalmente
                    log.disconnect(this.gameState!.roomCode, `"${player.name}" desconectou - grace period ${ResistServer.DISCONNECT_GRACE_PERIOD_MS / 1000}s`);

                    const gracePeriodTimeout = setTimeout(() => {
                        // Verifica se jogador ainda está desconectado após grace period
                        if (!this.gameState) return;
                        const stillDisconnected = this.gameState.players.find(
                            p => p.id === playerId && p.disconnected
                        );

                        if (stillDisconnected && !stillDisconnected.isSpectator) {
                            // Jogador não reconectou no tempo - agora sim pausa o jogo
                            log.disconnect(this.gameState!.roomCode, `"${stillDisconnected.name}" nao reconectou - jogo pausado`);
                            this.startDisconnectWait({ id: stillDisconnected.id, name: stillDisconnected.name });
                        }

                        this.gracePeriodTimers.delete(playerId);
                    }, ResistServer.DISCONNECT_GRACE_PERIOD_MS);

                    this.gracePeriodTimers.set(playerId, gracePeriodTimeout);

                    // Broadcast para mostrar jogador como desconectado (mas sem pausar ainda)
                    this.broadcastState();
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

            dispatchMessage(this.getServerContexts(), sender, data);
        } catch (e) {
            const errorType = e instanceof SyntaxError ? 'JSON inválido' :
                e instanceof TypeError ? 'Tipo inválido' : 'Erro desconhecido';
            log.error(this.gameState?.roomCode || this.room.id, `Erro ao processar mensagem (${errorType})`, e);
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
