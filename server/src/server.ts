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

    // Tempo de graça para reconexão (5 minutos)
    static readonly RECONNECT_GRACE_PERIOD_MS = 300000;

    constructor(public room: Party.Room) { }

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
    private handleJoin(conn: Party.Connection, name: string, avatarSeed: number) {
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

        // Verifica se é reconexão de jogador existente (mesmo nome)
        const existingPlayer = this.gameState.players.find(p => p.name === name && !p.isAi);
        if (existingPlayer) {
            // Cancela timeout de remoção se existir
            const timeout = this.disconnectedPlayers.get(existingPlayer.id);
            if (timeout) {
                clearTimeout(timeout);
                this.disconnectedPlayers.delete(existingPlayer.id);
            }

            // Registra nova conexão para o jogador existente
            this.connections.set(conn.id, existingPlayer.id);
            this.addLog(`> ${name} reconectou`);

            // Envia estado atual
            const message: ServerMessage = { type: 'STATE', state: this.gameState };
            conn.send(JSON.stringify(message));
            this.broadcastState();

            console.log(`[${this.room.id}] Jogador reconectou: ${name}`);
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
            isAi: false,
            isHost: isFirstPlayer,
            avatarSeed,
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

    // Processa ADD_AI
    private handleAddAi(conn: Party.Connection, name: string, avatarSeed: number) {
        if (!this.gameState || this.gameState.phase !== Phase.LOBBY) return;

        const player = this.getPlayerByConnection(conn.id);
        if (!player?.isHost) {
            this.sendError(conn, 'Apenas o host pode adicionar IAs');
            return;
        }

        if (this.gameState.players.length >= 10) {
            this.sendError(conn, 'Sala cheia');
            return;
        }

        const aiPlayer: Player = {
            id: 'ai-' + generateId(),
            name,
            role: Role.HUMAN,
            isAi: true,
            isHost: false,
            avatarSeed,
        };

        this.gameState.players.push(aiPlayer);
        this.addLog(`> IA ${name} adicionada`);
        this.broadcastState();
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

        // Verifica se todos votaram (apenas jogadores humanos, não IAs)
        const humanPlayers = this.gameState.players.filter(p => !p.isAi);
        const voteCount = Object.keys(this.gameState.missions[missionIndex].votes).length;

        // IAs votam automaticamente (simples: sempre aprovam)
        const aiPlayers = this.gameState.players.filter(p => p.isAi);
        for (const ai of aiPlayers) {
            if (!(ai.id in this.gameState.missions[missionIndex].votes)) {
                this.gameState.missions[missionIndex].votes[ai.id] = true;
            }
        }

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

        // IAs na equipe executam automaticamente
        for (const playerId of this.gameState.proposedTeam) {
            const teamPlayer = this.gameState.players.find(p => p.id === playerId);
            if (teamPlayer?.isAi) {
                const aiIndex = this.gameState.proposedTeam.indexOf(playerId);
                if (this.gameState.missions[missionIndex].missionOutcomes[aiIndex] === undefined) {
                    // IA Terminator pode sabotar (50% chance)
                    const aiOutcome = teamPlayer.role === Role.HUMAN ? true : Math.random() > 0.5;
                    this.gameState.missions[missionIndex].missionOutcomes[aiIndex] = aiOutcome;
                }
            }
        }

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
            } else if (failures >= 3) {
                this.gameState.winner = Role.TERMINATOR;
                this.gameState.phase = Phase.GAME_OVER;
                this.addLog(`> SKYNET PREVALECE!`);
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

                this.room.broadcast(JSON.stringify({ type: 'PLAYER_LEFT', name: player.name } as ServerMessage));
            }
        }
        this.connections.delete(conn.id);
    }

    // Quando recebe mensagem
    onMessage(message: string, sender: Party.Connection) {
        try {
            const data: ClientMessage = JSON.parse(message);
            console.log(`[${this.room.id}] Mensagem de ${sender.id}:`, data.type);

            switch (data.type) {
                case 'JOIN':
                    this.handleJoin(sender, data.name, data.avatarSeed);
                    break;
                case 'ADD_AI':
                    this.handleAddAi(sender, data.name, data.avatarSeed);
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
            }
        } catch (err) {
            console.error(`[${this.room.id}] Erro ao processar mensagem:`, err);
            this.sendError(sender, 'Erro ao processar mensagem');
        }
    }
}
