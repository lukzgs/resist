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

// Gera UUID seguro (compatível com diversos ambientes)
function generateUUID(): string {
    // Tenta usar crypto nativo (Node.js 19+, Cloudflare Workers, Browsers)
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }

    // Fallback para ambientes antigos ou restritos
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
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

    // Timer para espera de reconexão (sistema de votação)
    disconnectWaitTimer: NodeJS.Timeout | null = null;

    // Timer para votação de desconexão
    disconnectVoteTimer: NodeJS.Timeout | null = null;

    // Timer para limpeza da sala quando vazia
    roomCleanupTimeout: NodeJS.Timeout | null = null;

    // Tempo para limpar sala vazia (2 minutos) - permite reconexão se todos caírem
    static readonly EMPTY_ROOM_CLEANUP_MS = 120000;

    // Tempo de graça para reconexão (5 minutos)
    static readonly RECONNECT_GRACE_PERIOD_MS = 300000;

    // Tempo até a sala fechar após GAME_OVER (3 minutos)
    static readonly ROOM_EXPIRY_MS = 180000;

    // Tempo de espera para reconexão (2 minutos)
    static readonly DISCONNECT_WAIT_MS = 120000;

    // Tempo de votação (15 segundos)
    static readonly DISCONNECT_VOTE_MS = 15000;

    // Máximo de tentativas de espera
    static readonly MAX_DISCONNECT_ATTEMPTS = 3;

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

    // Inicia espera de reconexão quando jogador desconecta durante o jogo
    private startDisconnectWait(player: { id: string; name: string }, attempt: number = 1) {
        if (!this.gameState) return;

        // Cancela timers anteriores
        this.cancelDisconnectTimers();

        const now = Date.now();
        const expiresAt = now + ResistServer.DISCONNECT_WAIT_MS;

        // Salva estado anterior e pausa o jogo
        this.gameState.disconnectInfo = {
            disconnectedPlayerId: player.id,
            disconnectedPlayerName: player.name,
            pausedPhase: this.gameState.phase,
            waitingAttempt: attempt,
            pausedAt: now,
            expiresAt,
        };
        this.gameState.phase = Phase.PAUSED_DISCONNECT;
        this.gameState.disconnectVotes = {};

        this.addLog(`> ${player.name} desconectou - aguardando ${ResistServer.DISCONNECT_WAIT_MS / 1000}s...`);
        this.broadcastState();

        console.log(`[${this.room.id}] Aguardando reconexão de ${player.name} (tentativa ${attempt}/${ResistServer.MAX_DISCONNECT_ATTEMPTS})`);

        // Timer para iniciar votação
        this.disconnectWaitTimer = setTimeout(() => {
            this.startDisconnectVote();
        }, ResistServer.DISCONNECT_WAIT_MS);
    }

    // Cancela espera de reconexão (jogador reconectou)
    private cancelDisconnectWait() {
        if (!this.gameState || !this.gameState.disconnectInfo) return;

        this.cancelDisconnectTimers();

        const info = this.gameState.disconnectInfo;

        // Restaura fase anterior
        this.gameState.phase = info.pausedPhase;
        this.gameState.disconnectInfo = undefined;
        this.gameState.disconnectVotes = undefined;

        this.addLog(`> Jogador reconectou - retomando jogo`);
        this.broadcastState();

        console.log(`[${this.room.id}] Jogador reconectou - jogo retomado`);
    }

    // Cancela todos os timers de desconexão
    private cancelDisconnectTimers() {
        if (this.disconnectWaitTimer) {
            clearTimeout(this.disconnectWaitTimer);
            this.disconnectWaitTimer = null;
        }
        if (this.disconnectVoteTimer) {
            clearTimeout(this.disconnectVoteTimer);
            this.disconnectVoteTimer = null;
        }
    }

    // Inicia votação para decidir se encerra ou continua esperando
    private startDisconnectVote() {
        if (!this.gameState || !this.gameState.disconnectInfo) return;

        const info = this.gameState.disconnectInfo;
        const expiresAt = Date.now() + ResistServer.DISCONNECT_VOTE_MS;

        this.gameState.phase = Phase.DISCONNECT_VOTE;
        this.gameState.disconnectInfo.expiresAt = expiresAt;
        this.gameState.disconnectVotes = {};

        this.addLog(`> Votação: encerrar partida ou aguardar ${info.disconnectedPlayerName}?`);
        this.broadcastState();

        console.log(`[${this.room.id}] Votação de desconexão iniciada`);

        // Timer para resolver votação automaticamente
        this.disconnectVoteTimer = setTimeout(() => {
            this.resolveDisconnectVote();
        }, ResistServer.DISCONNECT_VOTE_MS);
    }

    // Processa voto de desconexão
    private handleDisconnectVote(conn: Party.Connection, endGame: boolean) {
        if (!this.gameState || this.gameState.phase !== Phase.DISCONNECT_VOTE) return;
        if (!this.gameState.disconnectVotes) return;

        const player = this.isActivePlayer(conn);
        if (!player) return;

        // Não pode votar se está desconectado
        if (player.disconnected) return;

        // Já votou?
        if (player.id in this.gameState.disconnectVotes) return;

        this.gameState.disconnectVotes[player.id] = endGame;
        this.broadcastState();

        // Verifica se todos votaram (exclui espectadores)
        const activePlayers = this.gameState.players.filter(p => !p.isSpectator && !p.disconnected);
        const voteCount = Object.keys(this.gameState.disconnectVotes).length;

        if (voteCount === activePlayers.length) {
            // Todos votaram, resolve imediatamente
            if (this.disconnectVoteTimer) {
                clearTimeout(this.disconnectVoteTimer);
                this.disconnectVoteTimer = null;
            }
            this.resolveDisconnectVote();
        }
    }

    // Resolve votação de desconexão
    private resolveDisconnectVote() {
        if (!this.gameState || !this.gameState.disconnectInfo) return;

        this.cancelDisconnectTimers();

        const info = this.gameState.disconnectInfo;
        const votes = this.gameState.disconnectVotes || {};
        const activePlayers = this.gameState.players.filter(p => !p.isSpectator && !p.disconnected);

        // Conta votos para encerrar
        const endGameVotes = Object.values(votes).filter(v => v === true).length;
        const majorityNeeded = Math.ceil(activePlayers.length / 2);

        console.log(`[${this.room.id}] Votação: ${endGameVotes}/${activePlayers.length} votaram encerrar (maioria: ${majorityNeeded})`);

        if (endGameVotes >= majorityNeeded) {
            // Maioria votou encerrar
            this.cancelGame(`Jogadores votaram para encerrar (${info.disconnectedPlayerName} desconectou)`);
        } else if (info.waitingAttempt >= ResistServer.MAX_DISCONNECT_ATTEMPTS) {
            // Máximo de tentativas atingido
            this.cancelGame(`${info.disconnectedPlayerName} não reconectou após ${ResistServer.MAX_DISCONNECT_ATTEMPTS} tentativas`);
        } else {
            // Continua esperando - nova tentativa
            this.addLog(`> Jogadores votaram para aguardar - tentativa ${info.waitingAttempt + 1}/${ResistServer.MAX_DISCONNECT_ATTEMPTS}`);

            // Mantém info mas incrementa tentativa
            const playerInfo = { id: info.disconnectedPlayerId, name: info.disconnectedPlayerName };
            this.startDisconnectWait(playerInfo, info.waitingAttempt + 1);
        }
    }

    // Cancela partida (sem vencedor)
    private cancelGame(reason: string) {
        if (!this.gameState) return;

        this.cancelDisconnectTimers();

        this.gameState.phase = Phase.GAME_OVER;
        this.gameState.winner = null;  // Sem vencedor
        this.gameState.disconnectInfo = undefined;
        this.gameState.disconnectVotes = undefined;

        this.addLog(`> PARTIDA CANCELADA: ${reason}`);
        this.scheduleRoomClosure();
        this.broadcastState();

        console.log(`[${this.room.id}] Partida cancelada: ${reason}`);
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
            showRejectionCount: true,  // Default: mostrar contagem de rejeições
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

    // Verifica se jogador pode realizar ações (não é espectador)
    private isActivePlayer(conn: Party.Connection): Player | null {
        const player = this.getPlayerByConnection(conn.id);
        if (!player) return null;
        if (player.isSpectator) {
            this.sendError(conn, 'Espectadores não podem interagir no jogo');
            return null;
        }
        return player;
    }

    // Processa JOIN
    private handleJoin(conn: Party.Connection, name: string, avatarSeed: number, sessionId?: string, isCreating?: boolean) {
        // Cancela timeout de limpeza da sala se cliente está reconectando
        if (this.roomCleanupTimeout) {
            console.log(`[${this.room.id}] Cliente reconectando - cancelando limpeza da sala`);
            clearTimeout(this.roomCleanupTimeout);
            this.roomCleanupTimeout = null;
        }

        // Se está tentando entrar (não criar) em uma sala que não existe ou está vazia
        // e não tem sessionId (não é reconexão), rejeita
        const roomIsEmpty = !this.gameState || this.gameState.players.length === 0;
        if (!isCreating && roomIsEmpty && !sessionId) {
            this.sendError(conn, 'Sala não encontrada');
            // Fecha conexão após enviar erro
            setTimeout(() => conn.close(), 100);
            return;
        }

        // Inicializa estado se necessário (apenas para criar sala)
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

        // Tenta reconexão APENAS por sessionId (único identificador válido)
        const existingPlayer = sessionId
            ? this.gameState.players.find(p => p.sessionId === sessionId)
            : null;

        if (existingPlayer) {
            // Cancela timeout de remoção se existir
            const timeout = this.disconnectedPlayers.get(existingPlayer.id);
            if (timeout) {
                clearTimeout(timeout);
                this.disconnectedPlayers.delete(existingPlayer.id);
            }

            // Registra nova conexão para o jogador existente
            this.connections.set(conn.id, existingPlayer.id);

            // Atualiza nome se mudou (permite trocar nome ao reconectar)
            if (existingPlayer.name !== name) {
                this.addLog(`> ${existingPlayer.name} agora é ${name}`);
                existingPlayer.name = name;
            }

            // Marca como conectado
            existingPlayer.disconnected = false;

            // Se era o jogador que causou pausa, cancela espera e retoma jogo
            if (this.gameState.disconnectInfo?.disconnectedPlayerId === existingPlayer.id) {
                this.cancelDisconnectWait();
            } else {
                this.addLog(`> ${existingPlayer.name} reconectou`);
                this.broadcastState();
            }

            // Envia estado atual
            const message: ServerMessage = { type: 'STATE', state: this.gameState };
            conn.send(JSON.stringify(message));

            console.log(`[${this.room.id}] Jogador reconectou: ${existingPlayer.name}`);
            return;
        }

        // Verifica limite de jogadores (não conta espectadores para o limite de jogo)
        const activePlayersCount = this.gameState.players.filter(p => !p.isSpectator).length;
        if (activePlayersCount >= 10) {
            this.sendError(conn, 'Sala cheia (máximo 10 jogadores)');
            return;
        }

        // Verifica se é tentativa de entrar após jogo começar
        const isGameInProgress = this.gameState.phase !== Phase.LOBBY;

        // NOMES DUPLICADOS SÃO PERMITIDOS - nome é apenas display, não identificador

        // Gera novo sessionId seguro
        const newSessionId = generateUUID();

        // Cria novo jogador (ou espectador se jogo já começou)
        const isFirstPlayer = this.gameState.players.length === 0;
        const newPlayer: Player = {
            id: generateId(),
            name,
            role: Role.HUMAN, // Será definido ao iniciar (irrelevante para espectadores)
            isHost: isFirstPlayer && !isGameInProgress,
            avatarSeed,
            sessionId: newSessionId,
            disconnected: false,
            isSpectator: isGameInProgress, // Marca como espectador se jogo já começou
        };

        console.log(`[${this.room.id}] Criando ${isGameInProgress ? 'espectador' : 'jogador'}: ${name}`);

        // Envia confirmação de sessão segura
        try {
            conn.send(JSON.stringify({
                type: 'SESSION_ESTABLISHED',
                sessionId: newSessionId,
                playerId: newPlayer.id
            } as ServerMessage));
        } catch (e) {
            console.error(`[${this.room.id}] Erro ao enviar SESSION_ESTABLISHED:`, e);
        }

        // Registra conexão e adiciona jogador
        this.connections.set(conn.id, newPlayer.id);
        this.gameState.players.push(newPlayer);
        this.addLog(`> ${name} conectou`);

        // Broadcast para todos (incluindo o novo jogador, teoricamente)
        this.broadcastState();

        // GARANTIA: Envia estado explicitamente para o novo jogador
        // Isso resolve casos onde o broadcast pode falhar ou ter race condition
        const stateMsg: ServerMessage = { type: 'STATE', state: this.gameState };
        conn.send(JSON.stringify(stateMsg));

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

        // Conta apenas jogadores ativos (não espectadores e conectados)
        const activePlayers = this.gameState.players.filter(p => !p.isSpectator && !p.disconnected);
        const pCount = activePlayers.length;

        if (pCount < 5 || pCount > 10) {
            this.sendError(conn, `Precisa de 5-10 jogadores conectados (atual: ${pCount})`);
            return;
        }

        const rules = GAME_RULES[pCount];

        // Distribui papéis apenas para jogadores ativos
        const roles: Role[] = [];
        for (let i = 0; i < rules.spyCount; i++) roles.push(Role.TERMINATOR);
        for (let i = 0; i < pCount - rules.spyCount; i++) roles.push(Role.HUMAN);
        const shuffledRoles = shuffle(roles);

        // Atribui papéis apenas aos jogadores ativos
        let roleIndex = 0;
        this.gameState.players = this.gameState.players.map((p) => {
            if (p.isSpectator || p.disconnected) {
                return p; // Mantém espectadores/desconectados sem papel
            }
            return {
                ...p,
                role: shuffledRoles[roleIndex++],
            };
        });

        // Cria missões
        this.gameState.missions = rules.missionSizes.map((size, i) => ({
            roundNumber: i + 1,
            requiredPlayers: size,
            requiresTwoFails: !!((rules.twoFailsRequiredRound4 && i === 3) || (rules.twoFailsRequiredRound5 && i === 4)),
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

        const player = this.isActivePlayer(conn);
        if (!player) return;
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

        const player = this.isActivePlayer(conn);
        if (!player) return;
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

        const player = this.isActivePlayer(conn);
        if (!player) return;

        const missionIndex = this.gameState.currentMissionIndex;
        const mission = this.gameState.missions[missionIndex];

        // Já votou?
        if (player.id in mission.votes) return;

        // Registra voto
        this.gameState.missions[missionIndex].votes[player.id] = approve;

        // Todos votaram? (conta apenas jogadores ativos que iniciaram a partida, exclui espectadores)
        const activePlayers = this.gameState.players.filter(p => !p.isSpectator && !p.disconnected);
        if (Object.keys(this.gameState.missions[missionIndex].votes).length === activePlayers.length) {
            const votes = Object.values(this.gameState.missions[missionIndex].votes);
            const approvals = votes.filter(v => v).length;
            const approved = approvals > activePlayers.length / 2;

            if (approved) {
                this.gameState.phase = Phase.MISSION_EXECUTION;
                this.gameState.failedVoteCount = 0;
                this.addLog(`> EQUIPE APROVADA (${approvals}/${activePlayers.length})`);
            } else {
                this.gameState.failedVoteCount++;
                this.addLog(`> EQUIPE REJEITADA (${approvals}/${activePlayers.length})`);

                if (this.gameState.failedVoteCount >= 3) {
                    this.gameState.phase = Phase.GAME_OVER;
                    this.gameState.winner = Role.TERMINATOR;
                    this.addLog(`> TERMINATORS VENCEM - 3 REJEIÇÕES`);
                    this.scheduleRoomClosure();
                } else {
                    this.gameState.phase = Phase.TEAM_SELECTION;
                    // Avança líder apenas entre jogadores ativos (não espectadores)
                    const activePlayerIds = activePlayers.map(p => p.id);
                    const currentLeaderId = this.gameState.players[this.gameState.leaderIndex].id;
                    const currentLeaderActiveIndex = activePlayerIds.indexOf(currentLeaderId);
                    const nextLeaderActiveIndex = (currentLeaderActiveIndex + 1) % activePlayerIds.length;
                    const nextLeaderId = activePlayerIds[nextLeaderActiveIndex];
                    this.gameState.leaderIndex = this.gameState.players.findIndex(p => p.id === nextLeaderId);
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

        const player = this.isActivePlayer(conn);
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

                // Marca como desconectado
                player.disconnected = true;

                // No lobby, dá 30 segundos para reconexão antes de remover
                if (this.gameState.phase === Phase.LOBBY) {
                    this.broadcastState();

                    // Agenda remoção após 30 segundos
                    const lobbyReconnectTimeout = setTimeout(() => {
                        if (this.gameState && this.gameState.phase === Phase.LOBBY) {
                            const playerStillDisconnected = this.gameState.players.find(
                                p => p.id === playerId && p.disconnected
                            );

                            if (playerStillDisconnected) {
                                // Remove o jogador
                                this.gameState.players = this.gameState.players.filter(p => p.id !== playerId);

                                // Se era host, passa para próximo jogador conectado
                                if (playerStillDisconnected.isHost && this.gameState.players.length > 0) {
                                    const nextHost = this.gameState.players.find(p => !p.disconnected);
                                    if (nextHost) {
                                        nextHost.isHost = true;
                                    } else if (this.gameState.players.length > 0) {
                                        this.gameState.players[0].isHost = true;
                                    }
                                }

                                this.addLog(`> ${playerStillDisconnected.name} removido por inatividade`);
                                this.broadcastState();
                                console.log(`[${this.room.id}] Jogador removido do lobby após timeout: ${playerStillDisconnected.name}`);
                            }
                        }
                    }, 30000); // 30 segundos de graça no lobby

                    // Armazena o timeout para poder cancelar se reconectar
                    this.disconnectedPlayers.set(playerId, lobbyReconnectTimeout);
                } else if (this.gameState.phase === Phase.GAME_OVER) {
                    // No GAME_OVER, apenas marca como desconectado
                    this.broadcastState();
                } else if (this.gameState.phase === Phase.PAUSED_DISCONNECT || this.gameState.phase === Phase.DISCONNECT_VOTE) {
                    // Já está pausado, apenas atualiza estado
                    this.broadcastState();
                } else {
                    // Durante o jogo normal: pausa e inicia sistema de espera
                    this.startDisconnectWait({ id: player.id, name: player.name });
                }
            }
        }
        this.connections.delete(conn.id);

        // Quando não há mais conexões ativas, espera 2 minutos antes de limpar
        // Isso permite que todos reconectem se caírem simultaneamente
        if (this.connections.size === 0 && !this.roomCleanupTimeout) {
            console.log(`[${this.room.id}] Nenhuma conexão ativa - aguardando ${ResistServer.EMPTY_ROOM_CLEANUP_MS / 1000}s antes de limpar...`);

            this.roomCleanupTimeout = setTimeout(() => {
                // Verifica novamente se não há conexões
                if (this.connections.size === 0) {
                    console.log(`[${this.room.id}] Sem reconexão - limpando estado da sala`);

                    // Cancela timeout de fechamento da sala se existir
                    if (this.gameOverTimeout) {
                        clearTimeout(this.gameOverTimeout);
                        this.gameOverTimeout = null;
                    }

                    // Cancela timers de desconexão
                    this.cancelDisconnectTimers();

                    // Cancela todos os timeouts de reconexão pendentes
                    for (const timeout of this.disconnectedPlayers.values()) {
                        clearTimeout(timeout);
                    }
                    this.disconnectedPlayers.clear();

                    // Limpa o estado do jogo
                    this.gameState = null;
                }
                this.roomCleanupTimeout = null;
            }, ResistServer.EMPTY_ROOM_CLEANUP_MS);
        }
    }

    // Quando recebe mensagem
    onMessage(message: string, sender: Party.Connection) {
        try {
            const data: ClientMessage = JSON.parse(message);
            console.log(`[${this.room.id}] Mensagem de ${sender.id}:`, data.type);

            switch (data.type) {
                case 'JOIN':
                    this.handleJoin(sender, data.name, data.avatarSeed, data.sessionId, data.isCreating);
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
                case 'SET_SHOW_REJECTION_COUNT':
                    if (this.gameState && this.gameState.phase === Phase.LOBBY) {
                        const playerId = this.connections.get(sender.id);
                        const player = this.gameState.players.find(p => p.id === playerId);
                        if (player?.isHost) {
                            this.gameState.showRejectionCount = data.enabled;
                            this.addLog(`> Contagem de rejeições ${data.enabled ? 'ativada' : 'desativada'}`);
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
                case 'DISCONNECT_VOTE':
                    this.handleDisconnectVote(sender, data.endGame);
                    break;
            }
        } catch (err) {
            console.error(`[${this.room.id}] Erro ao processar mensagem:`, err);
            this.sendError(sender, 'Erro ao processar mensagem');
        }
    }
}
