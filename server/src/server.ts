import type * as Party from "partykit/server";
import {
    GameState,
    Player,
    Phase,
    Role,
    Mission,
    ClientMessage,
    ServerMessage,
    GAME_RULES
} from "./types";

// Gera ID único
function generateId(): string {
    return Math.random().toString(36).substr(2, 8);
}

// Shuffle array (Fisher-Yates)
function shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export default class ResistServer implements Party.Server {
    // Estado do jogo
    gameState: GameState | null = null;

    // Mapa de conexões: connectionId -> playerId
    connections: Map<string, string> = new Map();

    // Mapa de jogadores desconectados pendentes de reconexão: playerId -> timeout
    disconnectedPlayers: Map<string, NodeJS.Timeout> = new Map();

    // Timer para fechar sala após GAME_OVER
    gameOverTimeout: NodeJS.Timeout | null = null;

    // Tempo de graça para reconexão (5 minutos)
    static readonly RECONNECT_GRACE_PERIOD_MS = 300000;

    // Tempo até a sala fechar após GAME_OVER (3 minutos)
    static readonly ROOM_EXPIRY_MS = 180000;

    constructor(public room: Party.Room) { }

    // Agenda fechamento da sala após GAME_OVER
    private scheduleRoomClosure() {
        // Cancela timeout anterior se existir
        if (this.gameOverTimeout) {
            clearTimeout(this.gameOverTimeout);
        }

        const expiresAt = Date.now() + ResistServer.ROOM_EXPIRY_MS;
        if (this.gameState) {
            this.gameState.roomExpiresAt = expiresAt;
        }

        console.log(`[${this.room.id}] Sala expira em ${ResistServer.ROOM_EXPIRY_MS / 1000}s`);

        this.gameOverTimeout = setTimeout(() => {
            console.log(`[${this.room.id}] Tempo expirado - fechando sala`);

            // Notifica todos os clientes
            this.room.broadcast(JSON.stringify({ type: 'ROOM_CLOSED' } as ServerMessage));

            // Desconecta todos
            for (const conn of this.room.getConnections()) {
                conn.close();
            }

            // Limpa estado
            this.gameState = null;
            this.connections.clear();
            this.disconnectedPlayers.clear();
        }, ResistServer.ROOM_EXPIRY_MS);
    }

    // Cancela o fechamento agendado da sala
    private cancelRoomClosure() {
        if (this.gameOverTimeout) {
            clearTimeout(this.gameOverTimeout);
            this.gameOverTimeout = null;
        }
        if (this.gameState) {
            this.gameState.roomExpiresAt = undefined;
        }
    }

    // Cria estado inicial do jogo
    private createInitialState(roomCode: string): GameState {
        return {
            phase: Phase.LOBBY,
            players: [],
            roomCode,
            leaderIndex: 0,
            currentMissionIndex: 0,
            missions: [],
            failedVoteCount: 0,
            proposedTeam: [],
            logs: [`> PROTOCOLO: ${roomCode}`],
            winner: null,
            anonymousVotes: true,  // Default: votos anônimos
        };
    }

    // Adiciona log ao estado
    private addLog(message: string) {
        if (this.gameState) {
            this.gameState.logs = [...this.gameState.logs.slice(-20), message];
        }
    }

    // Broadcast do estado para todos
    private broadcastState() {
        if (!this.gameState) return;
        const message: ServerMessage = { type: 'STATE', state: this.gameState };
        this.room.broadcast(JSON.stringify(message));
    }

    // Envia erro para um cliente específico
    private sendError(conn: Party.Connection, message: string) {
        const error: ServerMessage = { type: 'ERROR', message };
        conn.send(JSON.stringify(error));
    }

    // Encontra jogador pelo ID da conexão
    private getPlayerByConnection(connId: string): Player | undefined {
        const playerId = this.connections.get(connId);
        return this.gameState?.players.find(p => p.id === playerId);
    }

    // Processa JOIN
    private handleJoin(conn: Party.Connection, name: string, avatarSeed: number, sessionId?: string) {
        // Inicializa estado se necessário
        if (!this.gameState) {
            this.gameState = this.createInitialState(this.room.id);
        }

        // Verifica se já está conectado com esta conexão
        if (this.connections.has(conn.id)) {
            // Reconexão pela mesma conexão - apenas envia estado atual
            const message: ServerMessage = { type: 'STATE', state: this.gameState };
            conn.send(JSON.stringify(message));
            return;
        }

        // Tenta reconexão por sessionId primeiro (mais seguro)
        let existingPlayer = sessionId
            ? this.gameState.players.find(p => p.sessionId === sessionId)
            : null;

        // Se não encontrou por sessionId, tenta por nome (fallback)
        if (!existingPlayer) {
            existingPlayer = this.gameState.players.find(p => p.name === name);
        }

        if (existingPlayer) {
            // Cancela timeout de remoção se existir
            const timeout = this.disconnectedPlayers.get(existingPlayer.id);
            if (timeout) {
                clearTimeout(timeout);
                this.disconnectedPlayers.delete(existingPlayer.id);
            }

            // Registra nova conexão para o jogador existente
            this.connections.set(conn.id, existingPlayer.id);

            // Atualiza sessionId se fornecido (upgrade de sessão)
            if (sessionId && !existingPlayer.sessionId) {
                existingPlayer.sessionId = sessionId;
            }

            // Marca como conectado
            existingPlayer.disconnected = false;

            this.addLog(`> ${existingPlayer.name} reconectou`);

            // Envia estado atual
            const message: ServerMessage = { type: 'STATE', state: this.gameState };
            conn.send(JSON.stringify(message));
            this.broadcastState();

            console.log(`[${this.room.id}] Jogador reconectou: ${existingPlayer.name} (sessionId: ${sessionId || 'none'})`);
            return;
        }

        // Verifica limite de jogadores
        if (this.gameState.players.length >= 10) {
            this.sendError(conn, 'Sala cheia (máximo 10 jogadores)');
            return;
        }

        // Verifica se jogo já começou
        if (this.gameState.phase !== Phase.LOBBY) {
            this.sendError(conn, 'Jogo já em andamento');
            return;
        }

        // Cria novo jogador
        const isFirstPlayer = this.gameState.players.length === 0;
        const newPlayer: Player = {
            id: generateId(),
            name,
            role: Role.HUMAN, // Será definido ao iniciar
            isHost: isFirstPlayer,
            avatarSeed,
            sessionId,          // Armazena sessionId para reconexão futura
            disconnected: false,
        };

        // Registra conexão e adiciona jogador
        this.connections.set(conn.id, newPlayer.id);
        this.gameState.players.push(newPlayer);
        this.addLog(`> ${name} conectou`);

        // Broadcast para todos
        this.broadcastState();

        // Notifica entrada
        this.room.broadcast(JSON.stringify({ type: 'PLAYER_JOINED', name } as ServerMessage));
    }

    // Processa REMOVE_PLAYER
    private handleRemovePlayer(conn: Party.Connection) {
        if (!this.gameState || this.gameState.phase !== Phase.LOBBY) return;

        const player = this.getPlayerByConnection(conn.id);
        if (!player?.isHost) {
            this.sendError(conn, 'Apenas o host pode remover jogadores');
            return;
        }

        if (this.gameState.players.length <= 1) return;

        const removed = this.gameState.players.pop();
        if (removed) {
            this.addLog(`> ${removed.name} removido`);
            this.broadcastState();
        }
    }

    // Processa START_GAME
    private handleStartGame(conn: Party.Connection) {
        if (!this.gameState || this.gameState.phase !== Phase.LOBBY) return;

        const player = this.getPlayerByConnection(conn.id);
        if (!player?.isHost) {
            this.sendError(conn, 'Apenas o host pode iniciar');
            return;
        }

        const pCount = this.gameState.players.length;
        if (pCount < 5 || pCount > 10) {
            this.sendError(conn, 'Precisa de 5-10 jogadores');
            return;
        }

        const rules = GAME_RULES[pCount];

        // Distribui papéis
        const roles: Role[] = [];
        for (let i = 0; i < rules.spyCount; i++) roles.push(Role.TERMINATOR);
        for (let i = 0; i < pCount - rules.spyCount; i++) roles.push(Role.HUMAN);
        const shuffledRoles = shuffle(roles);

        // Atribui papéis aos jogadores
        this.gameState.players = this.gameState.players.map((p, i) => ({
            ...p,
            role: shuffledRoles[i],
        }));

        // Cria missões
        this.gameState.missions = rules.missionSizes.map((size, i) => ({
            roundNumber: i + 1,
            requiredPlayers: size,
            requiresTwoFails: !!(rules.twoFailsRequiredRound4 && i === 3),
            status: 'PENDING',
            team: [],
            votes: {},
            missionOutcomes: [],
        }));

        // Configura estado inicial
        this.gameState.phase = Phase.TEAM_SELECTION;
        this.gameState.leaderIndex = Math.floor(Math.random() * pCount);
        this.gameState.currentMissionIndex = 0;
        this.gameState.failedVoteCount = 0;
        this.gameState.proposedTeam = [];

        this.addLog(`> UNIDADE FORMADA: ${pCount} AGENTES`);
        this.addLog(`> ESCANEANDO ASSINATURAS...`);
        this.broadcastState();
    }

    // Processa SELECT_PLAYER
    private handleSelectPlayer(conn: Party.Connection, playerId: string) {
        if (!this.gameState || this.gameState.phase !== Phase.TEAM_SELECTION) return;

        const player = this.getPlayerByConnection(conn.id);
        const leader = this.gameState.players[this.gameState.leaderIndex];

        if (player?.id !== leader.id) {
            this.sendError(conn, 'Apenas o líder pode selecionar');
            return;
        }

        // Valida se o jogador alvo existe
        if (!this.gameState.players.some(p => p.id === playerId)) {
            this.sendError(conn, 'Jogador não encontrado');
            return;
        }

        const currentMission = this.gameState.missions[this.gameState.currentMissionIndex];
        const team = this.gameState.proposedTeam;

        if (team.includes(playerId)) {
            // Remove da equipe
            this.gameState.proposedTeam = team.filter(id => id !== playerId);
        } else if (team.length < currentMission.requiredPlayers) {
            // Adiciona à equipe
            this.gameState.proposedTeam = [...team, playerId];
        }

        this.broadcastState();
    }

    // Processa SUBMIT_TEAM
    private handleSubmitTeam(conn: Party.Connection) {
        if (!this.gameState || this.gameState.phase !== Phase.TEAM_SELECTION) return;

        const player = this.getPlayerByConnection(conn.id);
        const leader = this.gameState.players[this.gameState.leaderIndex];

        if (player?.id !== leader.id) {
            this.sendError(conn, 'Apenas o líder pode submeter');
            return;
        }

        const currentMission = this.gameState.missions[this.gameState.currentMissionIndex];
        if (this.gameState.proposedTeam.length !== currentMission.requiredPlayers) {
            this.sendError(conn, `Selecione exatamente ${currentMission.requiredPlayers} jogadores`);
            return;
        }

        // Limpa votos anteriores
        this.gameState.missions[this.gameState.currentMissionIndex].votes = {};
        this.gameState.phase = Phase.TEAM_VOTE;
        this.addLog(`> ESQUADRÃO PROPOSTO PELO COMANDANTE`);
        this.broadcastState();
    }

    // Processa VOTE
    private handleVote(conn: Party.Connection, approve: boolean) {
        if (!this.gameState || this.gameState.phase !== Phase.TEAM_VOTE) return;

        const player = this.getPlayerByConnection(conn.id);
        if (!player) return;

        const missionIndex = this.gameState.currentMissionIndex;
        const mission = this.gameState.missions[missionIndex];

        // Já votou?
        if (player.id in mission.votes) return;

        // Registra voto
        this.gameState.missions[missionIndex].votes[player.id] = approve;

        // Todos votaram?
        if (Object.keys(this.gameState.missions[missionIndex].votes).length === this.gameState.players.length) {
            const votes = Object.values(this.gameState.missions[missionIndex].votes);
            const approvals = votes.filter(v => v).length;
            const approved = approvals > this.gameState.players.length / 2;

            if (approved) {
                this.gameState.phase = Phase.MISSION_EXECUTION;
                this.gameState.failedVoteCount = 0;
                this.addLog(`> EQUIPE APROVADA (${approvals}/${this.gameState.players.length})`);
            } else {
                this.gameState.failedVoteCount++;
                this.addLog(`> EQUIPE REJEITADA (${approvals}/${this.gameState.players.length})`);

                if (this.gameState.failedVoteCount >= 5) {
                    this.gameState.phase = Phase.GAME_OVER;
                    this.gameState.winner = Role.TERMINATOR;
                    this.addLog(`> TERMINATORS VENCEM - 5 REJEIÇÕES`);
                    this.scheduleRoomClosure();
                } else {
                    this.gameState.phase = Phase.TEAM_SELECTION;
                    this.gameState.leaderIndex = (this.gameState.leaderIndex + 1) % this.gameState.players.length;
                    this.gameState.proposedTeam = [];
                    // Limpa votos para próxima rodada
                    this.gameState.missions[missionIndex].votes = {};
                }
            }
        }

        this.broadcastState();
    }

    // Processa MISSION_ACTION
    private handleMissionAction(conn: Party.Connection, success: boolean) {
        if (!this.gameState || this.gameState.phase !== Phase.MISSION_EXECUTION) return;

        const player = this.getPlayerByConnection(conn.id);
        if (!player) return;

        // Verifica se está na equipe
        if (!this.gameState.proposedTeam.includes(player.id)) {
            this.sendError(conn, 'Você não está na equipe');
            return;
        }

        const missionIndex = this.gameState.currentMissionIndex;
        const mission = this.gameState.missions[missionIndex];

        // Já contribuiu?
        const teamIndex = this.gameState.proposedTeam.indexOf(player.id);
        if (mission.missionOutcomes[teamIndex] !== undefined) return;

        // Humanos sempre devem passar sucesso
        const outcome = player.role === Role.HUMAN ? true : success;

        // Registra outcome
        while (this.gameState.missions[missionIndex].missionOutcomes.length <= teamIndex) {
            this.gameState.missions[missionIndex].missionOutcomes.push(undefined as any);
        }
        this.gameState.missions[missionIndex].missionOutcomes[teamIndex] = outcome;

        // Verifica se missão está completa
        const outcomes = this.gameState.missions[missionIndex].missionOutcomes.filter(o => o !== undefined);
        if (outcomes.length === mission.requiredPlayers) {
            const fails = outcomes.filter(o => !o).length;
            const isFailed = mission.requiresTwoFails ? fails >= 2 : fails >= 1;

            this.gameState.missions[missionIndex].status = isFailed ? 'FAIL' : 'SUCCESS';
            this.addLog(`> MISSÃO ${missionIndex + 1}: ${isFailed ? 'FALHOU' : 'SUCESSO'} (${fails} sabotagem${fails !== 1 ? 's' : ''})`);

            const successes = this.gameState.missions.filter(m => m.status === 'SUCCESS').length;
            const failures = this.gameState.missions.filter(m => m.status === 'FAIL').length;

            if (successes >= 3) {
                this.gameState.winner = Role.HUMAN;
                this.gameState.phase = Phase.GAME_OVER;
                this.addLog(`> RESISTÊNCIA VENCE!`);
                this.scheduleRoomClosure();
            } else if (failures >= 3) {
                this.gameState.winner = Role.TERMINATOR;
                this.gameState.phase = Phase.GAME_OVER;
                this.addLog(`> SKYNET PREVALECE!`);
                this.scheduleRoomClosure();
            } else {
                // Próxima missão
                this.gameState.currentMissionIndex++;
                this.gameState.phase = Phase.TEAM_SELECTION;
                this.gameState.leaderIndex = (this.gameState.leaderIndex + 1) % this.gameState.players.length;
                this.gameState.proposedTeam = [];
            }
        }

        this.broadcastState();
    }

    // Quando um cliente conecta
    onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
        console.log(`[${this.room.id}] Nova conexão: ${conn.id}`);

        // Se existe estado, envia para reconexão
        if (this.gameState) {
            const message: ServerMessage = { type: 'STATE', state: this.gameState };
            conn.send(JSON.stringify(message));
        }
    }

    // Quando um cliente desconecta
    onClose(conn: Party.Connection) {
        const playerId = this.connections.get(conn.id);
        if (playerId && this.gameState) {
            const player = this.gameState.players.find(p => p.id === playerId);
            if (player) {
                console.log(`[${this.room.id}] Desconectou: ${player.name}`);
                this.addLog(`> ${player.name} desconectou`);

                // Marca como desconectado
                player.disconnected = true;

                // No lobby, remove imediatamente
                if (this.gameState.phase === Phase.LOBBY) {
                    this.gameState.players = this.gameState.players.filter(p => p.id !== playerId);

                    // Se era host, passa para próximo
                    if (player.isHost && this.gameState.players.length > 0) {
                        this.gameState.players[0].isHost = true;
                    }

                    this.broadcastState();
                } else {
                    // Durante o jogo, dá tempo para reconectar
                    console.log(`[${this.room.id}] Aguardando reconexão de ${player.name} por ${ResistServer.RECONNECT_GRACE_PERIOD_MS / 1000}s`);

                    const timeout = setTimeout(() => {
                        // Jogador não reconectou - trata como abandono
                        console.log(`[${this.room.id}] ${player.name} não reconectou - abandonou`);
                        this.addLog(`> ${player.name} abandonou o jogo`);
                        this.disconnectedPlayers.delete(playerId);

                        // Remove das conexões ativas (já removido) e notifica
                        this.room.broadcast(JSON.stringify({ type: 'PLAYER_LEFT', name: player.name } as ServerMessage));
                        this.broadcastState();
                    }, ResistServer.RECONNECT_GRACE_PERIOD_MS);

                    this.disconnectedPlayers.set(playerId, timeout);
                }
            }
        }
        this.connections.delete(conn.id);

        // Limpa estado quando não há mais conexões ativas
        if (this.connections.size === 0) {
            console.log(`[${this.room.id}] Nenhuma conexão ativa - limpando estado da sala`);

            // Cancela timeout de fechamento da sala se existir
            if (this.gameOverTimeout) {
                clearTimeout(this.gameOverTimeout);
                this.gameOverTimeout = null;
            }

            // Cancela todos os timeouts de reconexão pendentes
            for (const timeout of this.disconnectedPlayers.values()) {
                clearTimeout(timeout);
            }
            this.disconnectedPlayers.clear();

            // Limpa o estado do jogo
            this.gameState = null;
        }
    }

    // Quando recebe mensagem
    onMessage(message: string, sender: Party.Connection) {
        try {
            const data: ClientMessage = JSON.parse(message);
            console.log(`[${this.room.id}] Mensagem de ${sender.id}:`, data.type);

            switch (data.type) {
                case 'JOIN':
                    this.handleJoin(sender, data.name, data.avatarSeed, data.sessionId);
                    break;
                case 'REMOVE_PLAYER':
                    this.handleRemovePlayer(sender);
                    break;
                case 'START_GAME':
                    this.handleStartGame(sender);
                    break;
                case 'SELECT_PLAYER':
                    this.handleSelectPlayer(sender, data.playerId);
                    break;
                case 'SUBMIT_TEAM':
                    this.handleSubmitTeam(sender);
                    break;
                case 'VOTE':
                    this.handleVote(sender, data.approve);
                    break;
                case 'MISSION_ACTION':
                    this.handleMissionAction(sender, data.success);
                    break;
                case 'SET_ANONYMOUS_VOTES':
                    if (this.gameState && this.gameState.phase === Phase.LOBBY) {
                        const playerId = this.connections.get(sender.id);
                        const player = this.gameState.players.find(p => p.id === playerId);
                        if (player?.isHost) {
                            this.gameState.anonymousVotes = data.enabled;
                            this.addLog(`> Votos ${data.enabled ? 'anônimos' : 'públicos'}`);
                            this.broadcastState();
                        }
                    }
                    break;
                case 'RESTART_GAME':
                    if (this.gameState && this.gameState.phase === Phase.GAME_OVER) {
                        const playerId = this.connections.get(sender.id);
                        const player = this.gameState.players.find(p => p.id === playerId);
                        if (player?.isHost) {
                            // Cancela o timeout de fechamento
                            this.cancelRoomClosure();

                            // Reseta para lobby mantendo jogadores
                            this.gameState.phase = Phase.LOBBY;
                            this.gameState.winner = null;
                            this.gameState.leaderIndex = 0;
                            this.gameState.currentMissionIndex = 0;
                            this.gameState.missions = [];
                            this.gameState.failedVoteCount = 0;
                            this.gameState.proposedTeam = [];

                            // Reseta roles dos jogadores
                            this.gameState.players = this.gameState.players.map(p => ({
                                ...p,
                                role: Role.HUMAN,  // Será redistribuído ao iniciar
                            }));

                            this.addLog(`> NOVA PARTIDA INICIADA`);
                            this.broadcastState();
                            console.log(`[${this.room.id}] Jogo reiniciado pelo host`);
                        } else {
                            this.sendError(sender, 'Apenas o host pode reiniciar o jogo');
                        }
                    }
                    break;
            }
        } catch (err) {
            console.error(`[${this.room.id}] Erro ao processar mensagem:`, err);
            this.sendError(sender, 'Erro ao processar mensagem');
        }
    }
}
