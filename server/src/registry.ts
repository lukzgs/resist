import type * as Party from "partykit/server";
import { generateRoomCode } from './utils/crypto';
import { log } from './utils/logger';

// Limite máximo de salas simultâneas
const MAX_ROOMS = 50;

// Máximo de salas retornadas na listagem
const MAX_ROOMS_LIST = 20;

// Tempo máximo que uma sala pode ficar no registry (5 minutos no lobby)
const LOBBY_MAX_AGE_MS = 5 * 60 * 1000;

// Tempo máximo total de uma sala (2 horas)
const ROOM_MAX_AGE_MS = 2 * 60 * 60 * 1000;

// Intervalo de limpeza de salas órfãs (1 minuto)
const CLEANUP_INTERVAL_MS = 1 * 60 * 1000;

interface RoomInfo {
    code: string;
    name: string;  // Nome personalizado da sala
    createdAt: number;
    playerCount: number;
    phase: string;  // LOBBY, TEAM_SELECTION, etc.
    isPublic: boolean;  // Se a sala aparece na lista pública
}

interface RegistryState {
    activeRooms: RoomInfo[];
    lastCleanup: number;
}

/**
 * Registry Server - Controla limite de salas simultâneas
 * 
 * Endpoints:
 * - POST /register - Registra nova sala e retorna código
 * - POST /unregister - Remove sala do registro
 * - POST /update - Atualiza info da sala (playerCount, phase)
 * - GET /rooms - Lista salas públicas disponíveis
 * - GET /stats - Estatísticas do servidor
 */
export default class RegistryServer implements Party.Server {
    private state: RegistryState = {
        activeRooms: [],
        lastCleanup: Date.now()
    };

    constructor(public room: Party.Room) { }

    async onStart(): Promise<void> {
        const saved = await this.room.storage.get<RegistryState>("state");
        if (saved) {
            this.state = saved;
        }
        // Agenda limpeza periódica
        await this.scheduleCleanup();
    }

    private async saveState(): Promise<void> {
        await this.room.storage.put("state", this.state);
    }

    private async scheduleCleanup(): Promise<void> {
        await this.room.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);
    }

    async onAlarm(): Promise<void> {
        await this.cleanupOrphanRooms();
        await this.scheduleCleanup();
    }

    /**
     * Remove salas antigas/órfãs
     */
    private async cleanupOrphanRooms(): Promise<void> {
        const now = Date.now();
        const before = this.state.activeRooms.length;

        this.state.activeRooms = this.state.activeRooms.filter(room => {
            const age = now - room.createdAt;

            // Salas em LOBBY expiram em 5 minutos
            if (room.phase === 'LOBBY' && age >= LOBBY_MAX_AGE_MS) {
                return false;
            }

            // Todas as salas expiram em 2 horas
            if (age >= ROOM_MAX_AGE_MS) {
                return false;
            }

            return true;
        });

        if (before !== this.state.activeRooms.length) {
            log.registry(`Cleanup: removidas ${before - this.state.activeRooms.length} salas orfas`);
            await this.saveState();
        }

        this.state.lastCleanup = now;
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

        const path = url.pathname.split('/').pop();

        try {
            // POST /register - Registra nova sala
            if (req.method === 'POST' && path === 'register') {
                return await this.handleRegister(req, corsHeaders);
            }

            // POST /unregister - Remove sala
            if (req.method === 'POST' && path === 'unregister') {
                return await this.handleUnregister(req, corsHeaders);
            }

            // POST /update - Atualiza info da sala
            if (req.method === 'POST' && path === 'update') {
                return await this.handleUpdate(req, corsHeaders);
            }

            // GET /rooms - Lista salas públicas
            if (req.method === 'GET' && path === 'rooms') {
                return this.handleGetRooms(corsHeaders);
            }

            // GET /stats - Estatísticas
            if (req.method === 'GET' && path === 'stats') {
                return this.handleGetStats(corsHeaders);
            }

            // GET / - Health check
            if (req.method === 'GET') {
                return new Response(JSON.stringify({
                    status: 'ok',
                    activeRooms: this.state.activeRooms.length,
                    maxRooms: MAX_ROOMS
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            return new Response('Not found', { status: 404, headers: corsHeaders });
        } catch (e) {
            log.error('', 'Registry: erro ao processar request', e);
            return new Response(JSON.stringify({ error: 'Erro interno' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
    }

    /**
     * Registra nova sala e retorna código gerado
     */
    private async handleRegister(req: Party.Request, corsHeaders: Record<string, string>): Promise<Response> {
        // Verifica limite
        if (this.state.activeRooms.length >= MAX_ROOMS) {
            return new Response(JSON.stringify({
                error: 'Limite de salas atingido. Tente novamente mais tarde.',
                currentRooms: this.state.activeRooms.length,
                maxRooms: MAX_ROOMS
            }), {
                status: 429,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Gera código único
        let code: string;
        let attempts = 0;
        do {
            code = generateRoomCode();
            attempts++;
        } while (this.state.activeRooms.some(r => r.code === code) && attempts < 10);

        if (attempts >= 10) {
            return new Response(JSON.stringify({ error: 'Falha ao gerar código único' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Registra sala - público por padrão
        const body = await req.json().catch(() => ({})) as { isPublic?: boolean; name?: string };
        const roomInfo: RoomInfo = {
            code,
            name: body.name || `Sala ${code}`,  // Default: "Sala XXXX"
            createdAt: Date.now(),
            playerCount: 0,
            phase: 'LOBBY',
            isPublic: body.isPublic ?? true  // Público por padrão
        };

        this.state.activeRooms.push(roomInfo);
        await this.saveState();

        log.registry(`Sala ${code} registrada (${this.state.activeRooms.length}/${MAX_ROOMS})`);

        return new Response(JSON.stringify({
            code,
            currentRooms: this.state.activeRooms.length,
            maxRooms: MAX_ROOMS
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    /**
     * Remove sala do registro
     */
    private async handleUnregister(req: Party.Request, corsHeaders: Record<string, string>): Promise<Response> {
        const body = await req.json() as { code: string };

        if (!body.code) {
            return new Response(JSON.stringify({ error: 'Código não informado' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const before = this.state.activeRooms.length;
        this.state.activeRooms = this.state.activeRooms.filter(r => r.code !== body.code);

        if (before !== this.state.activeRooms.length) {
            await this.saveState();
            log.registry(`Sala ${body.code} removida (${this.state.activeRooms.length}/${MAX_ROOMS})`);
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    /**
     * Atualiza informações da sala
     */
    private async handleUpdate(req: Party.Request, corsHeaders: Record<string, string>): Promise<Response> {
        const body = await req.json() as { code: string; playerCount?: number; phase?: string; isPublic?: boolean };

        if (!body.code) {
            return new Response(JSON.stringify({ error: 'Código não informado' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const room = this.state.activeRooms.find(r => r.code === body.code);
        if (!room) {
            return new Response(JSON.stringify({ error: 'Sala não encontrada' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Atualiza campos
        if (body.playerCount !== undefined) {
            room.playerCount = body.playerCount;
            log.registry(`Sala ${body.code} atualizada: ${body.playerCount} jogadores`);
        }
        if (body.phase !== undefined) room.phase = body.phase;
        if (body.isPublic !== undefined) room.isPublic = body.isPublic;

        await this.saveState();

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    /**
     * Lista salas públicas disponíveis (limite 20)
     */
    private handleGetRooms(corsHeaders: Record<string, string>): Response {
        const now = Date.now();

        const publicRooms = this.state.activeRooms
            .filter(r => {
                // Apenas salas públicas, em LOBBY, não cheias
                if (!r.isPublic || r.phase !== 'LOBBY' || r.playerCount >= 10) {
                    return false;
                }
                // Não retornar salas expiradas (mais de 5 minutos)
                const age = now - r.createdAt;
                if (age >= LOBBY_MAX_AGE_MS) {
                    return false;
                }
                return true;
            })
            .slice(0, MAX_ROOMS_LIST)  // Limita a 20
            .map(r => {
                const expiresAt = r.createdAt + LOBBY_MAX_AGE_MS;
                const expiresIn = Math.max(0, expiresAt - now);

                return {
                    code: r.code,
                    name: r.name,
                    playerCount: r.playerCount,
                    createdAt: r.createdAt,
                    expiresAt,
                    expiresIn,  // Milissegundos restantes
                    isClosingSoon: expiresIn <= 60 * 1000  // Menos de 1 minuto
                };
            })
            .sort((a, b) => b.playerCount - a.playerCount);  // Mais jogadores primeiro

        return new Response(JSON.stringify({ rooms: publicRooms }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    /**
     * Estatísticas do servidor
     */
    private handleGetStats(corsHeaders: Record<string, string>): Response {
        const stats = {
            activeRooms: this.state.activeRooms.length,
            maxRooms: MAX_ROOMS,
            publicRooms: this.state.activeRooms.filter(r => r.isPublic).length,
            inLobby: this.state.activeRooms.filter(r => r.phase === 'LOBBY').length,
            inGame: this.state.activeRooms.filter(r => r.phase !== 'LOBBY').length,
            lastCleanup: this.state.lastCleanup
        };

        return new Response(JSON.stringify(stats), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
