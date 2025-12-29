import { useState, useCallback, useEffect, useRef } from 'react';
import PartySocket from 'partysocket';
import { GameState } from '../types';

// URL do servidor PartyKit (desenvolvimento ou produção)
// @ts-ignore - Vite injects this
const PARTYKIT_HOST = (import.meta as any).env?.VITE_PARTYKIT_HOST || 'localhost:1999';

// Configuração de reconexão
const RECONNECT_DELAY_MS = 1000; // Delay inicial entre tentativas
const MAX_RECONNECT_DELAY_MS = 30000; // Delay máximo (30s)
const MAX_RECONNECT_ATTEMPTS = 10; // Tentativas máximas antes de desistir

// Chave do localStorage para sessão - agora única por sala
const SESSION_STORAGE_PREFIX = 'resist_session_';

interface StoredSession {
    sessionId: string;
    roomCode: string;
    playerName: string;
}

// Gera chave única para a sessão (baseada no roomCode)
function getSessionKey(roomCode: string): string {
    return `${SESSION_STORAGE_PREFIX}${roomCode}`;
}

// Recupera sessão do localStorage
function getStoredSessionId(roomCode: string, playerName: string): string | undefined {
    try {
        const key = getSessionKey(roomCode);
        const stored = localStorage.getItem(key);
        if (stored) {
            const session: StoredSession = JSON.parse(stored);
            // Retorna sessionId apenas se é o mesmo jogador
            if (session.playerName === playerName) {
                return session.sessionId;
            }
        }
    } catch (e) {
        console.warn('[Session] Erro ao ler sessão:', e);
    }
    return undefined;
}

// Salva sessão no localStorage
function saveSessionId(roomCode: string, playerName: string, sessionId: string) {
    try {
        const key = getSessionKey(roomCode);
        const session: StoredSession = { sessionId, roomCode, playerName };
        localStorage.setItem(key, JSON.stringify(session));
    } catch (e) {
        console.warn('[Session] Erro ao salvar sessão:', e);
    }
}

// Limpa sessão do localStorage (exportada para uso externo)
export function clearSession(roomCode?: string) {
    try {
        if (roomCode) {
            localStorage.removeItem(getSessionKey(roomCode));
        } else {
            // Limpa todas as sessões resist
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(SESSION_STORAGE_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        }
    } catch (e) {
        console.warn('[Session] Erro ao limpar sessão:', e);
    }
}

interface UsePartySocketOptions {
    roomCode: string;
    playerName: string;
    avatarSeed: number;
    isCreating?: boolean;  // true se está criando sala, false se entrando em existente
    onStateUpdate: (state: GameState) => void;
    onError: (message: string) => void;
    onPlayerJoined?: (name: string) => void;
    onPlayerLeft?: (name: string) => void;
    onConnectionChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting') => void;
    onRoomClosed?: () => void;
}

interface UsePartySocketReturn {
    isConnected: boolean;
    isConnecting: boolean;
    isReconnecting: boolean;
    reconnectAttempt: number;
    connect: () => void;
    disconnect: () => void;
    send: (message: any) => void;
    // Ações do jogo
    leaveRoom: () => void;
    removePlayer: () => void;
    startGame: () => void;
    selectPlayer: (playerId: string) => void;
    submitTeam: () => void;
    vote: (approve: boolean) => void;
    missionAction: (success: boolean) => void;
    setAnonymousVotes: (enabled: boolean) => void;
    setShowRejectionCount: (enabled: boolean) => void;
    restartGame: () => void;
    disconnectVote: (endGame: boolean) => void;
}

export function usePartySocket(options: UsePartySocketOptions): UsePartySocketReturn {
    const {
        roomCode,
        playerName,
        avatarSeed,
        isCreating,
        onStateUpdate,
        onError,
        onPlayerJoined,
        onPlayerLeft,
        onConnectionChange,
        onRoomClosed
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);

    const socketRef = useRef<PartySocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const shouldReconnectRef = useRef(true);
    const lastRoomCodeRef = useRef(roomCode);
    const lastPlayerNameRef = useRef(playerName);
    const lastAvatarSeedRef = useRef(avatarSeed);
    const isCreatingRef = useRef(isCreating);

    // Atualiza as refs quando os valores mudam
    useEffect(() => {
        lastRoomCodeRef.current = roomCode;
        lastPlayerNameRef.current = playerName;
        lastAvatarSeedRef.current = avatarSeed;
        isCreatingRef.current = isCreating;
    }, [roomCode, playerName, avatarSeed, isCreating]);

    // Limpa timeout de reconexão
    const clearReconnectTimeout = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
    }, []);

    // Calcula delay de reconexão com backoff exponencial
    const getReconnectDelay = useCallback((attempt: number) => {
        const delay = RECONNECT_DELAY_MS * Math.pow(2, attempt);
        return Math.min(delay, MAX_RECONNECT_DELAY_MS);
    }, []);

    // Função principal de conexão
    const connect = useCallback(() => {
        if (socketRef.current) {
            return;
        }

        const currentRoomCode = lastRoomCodeRef.current;
        const currentPlayerName = lastPlayerNameRef.current;
        const currentAvatarSeed = lastAvatarSeedRef.current;

        if (!currentRoomCode) {
            return;
        }

        shouldReconnectRef.current = true;
        setIsConnecting(true);
        onConnectionChange?.('connecting');

        try {
            const socket = new PartySocket({
                host: PARTYKIT_HOST,
                room: currentRoomCode,
            });

            socket.addEventListener('open', () => {
                setIsConnected(true);
                setIsConnecting(false);
                setIsReconnecting(false);
                setReconnectAttempt(0);
                onConnectionChange?.('connected');

                // Tenta recuperar sessão existente
                const sessionId = getStoredSessionId(currentRoomCode, currentPlayerName);

                // Envia JOIN (se tiver sessionId, o servidor tenta reconectar; se não, cria nova)
                socket.send(JSON.stringify({
                    type: 'JOIN',
                    name: currentPlayerName,
                    avatarSeed: currentAvatarSeed,
                    sessionId,
                    isCreating: isCreatingRef.current,
                }));
            });

            socket.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);

                    switch (data.type) {
                        case 'STATE':
                            onStateUpdate(data.state);
                            break;
                        case 'ERROR':
                            onError(data.message);
                            // Erros fatais: para de tentar reconectar
                            if (data.message.includes('não encontrada') ||
                                data.message.includes('cheia') ||
                                data.message.includes('not found')) {
                                shouldReconnectRef.current = false;
                                clearReconnectTimeout();
                            }
                            break;
                        case 'PLAYER_JOINED':
                            onPlayerJoined?.(data.name);
                            break;
                        case 'PLAYER_LEFT':
                            onPlayerLeft?.(data.name);
                            break;
                        case 'ROOM_CLOSED':
                            shouldReconnectRef.current = false;  // Impede reconexão
                            clearSession();  // Limpa sessão do localStorage
                            onRoomClosed?.();
                            break;
                        case 'SESSION_ESTABLISHED':
                            // Recebe crachá oficial do servidor e salva
                            try {
                                saveSessionId(
                                    lastRoomCodeRef.current,
                                    lastPlayerNameRef.current,
                                    (data as any).sessionId
                                );
                                console.log('[Session] Sessão segura estabelecida');
                            } catch (e) {
                                console.error('[Session] Erro ao salvar sessão segura:', e);
                            }
                            break;
                    }
                } catch (err) {
                    console.error('[WS] Erro ao processar mensagem:', err);
                }
            });

            socket.addEventListener('close', (event) => {
                console.log(`[WS] Desconectado (code: ${event.code}, reason: ${event.reason})`);
                setIsConnected(false);
                socketRef.current = null;

                // Tenta reconectar se não foi desconexão intencional
                if (shouldReconnectRef.current && reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
                    const nextAttempt = reconnectAttempt + 1;
                    const delay = getReconnectDelay(nextAttempt);

                    console.log(`[WS] Tentando reconectar em ${delay}ms (tentativa ${nextAttempt}/${MAX_RECONNECT_ATTEMPTS})`);

                    setIsReconnecting(true);
                    setReconnectAttempt(nextAttempt);
                    onConnectionChange?.('reconnecting');

                    reconnectTimeoutRef.current = setTimeout(() => {
                        if (shouldReconnectRef.current) {
                            connect();
                        }
                    }, delay);
                } else if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
                    console.log('[WS] Máximo de tentativas de reconexão atingido');
                    setIsReconnecting(false);
                    onConnectionChange?.('disconnected');
                    onError('Conexão perdida. Por favor, recarregue a página.');
                }
            });

            socket.addEventListener('error', (err) => {
                console.error('[WS] Erro:', err);
                setIsConnecting(false);
                // O evento 'close' será disparado após o erro
            });

            socketRef.current = socket;
        } catch (err) {
            console.error('[WS] Erro ao criar conexão:', err);
            setIsConnecting(false);
            onError('Não foi possível conectar ao servidor');
        }
    }, [reconnectAttempt, getReconnectDelay, onStateUpdate, onError, onPlayerJoined, onPlayerLeft, onConnectionChange, onRoomClosed]);

    // Desconecta (não limpa sessão - permite reconexão)
    const disconnect = useCallback(() => {
        shouldReconnectRef.current = false;
        clearReconnectTimeout();
        // NÃO limpa sessão aqui - permite reconexão automática

        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }

        setIsConnected(false);
        setIsConnecting(false);
        setIsReconnecting(false);
        setReconnectAttempt(0);
        onConnectionChange?.('disconnected');
    }, [clearReconnectTimeout, onConnectionChange]);

    // Envia mensagem
    const send = useCallback((message: any) => {
        if (socketRef.current && isConnected) {
            socketRef.current.send(JSON.stringify(message));
        } else {
            console.warn('[WS] Tentativa de envio sem conexão ativa');
        }
    }, [isConnected]);

    // Ações do jogo
    const leaveRoom = useCallback(() => {
        send({ type: 'LEAVE_ROOM' });
        // O servidor vai fechar a conexão após processar
    }, [send]);

    const removePlayer = useCallback(() => {
        send({ type: 'REMOVE_PLAYER' });
    }, [send]);

    const startGame = useCallback(() => {
        send({ type: 'START_GAME' });
    }, [send]);

    const selectPlayer = useCallback((playerId: string) => {
        send({ type: 'SELECT_PLAYER', playerId });
    }, [send]);

    const submitTeam = useCallback(() => {
        send({ type: 'SUBMIT_TEAM' });
    }, [send]);

    const vote = useCallback((approve: boolean) => {
        send({ type: 'VOTE', approve });
    }, [send]);

    const missionAction = useCallback((success: boolean) => {
        send({ type: 'MISSION_ACTION', success });
    }, [send]);

    const setAnonymousVotes = useCallback((enabled: boolean) => {
        send({ type: 'SET_ANONYMOUS_VOTES', enabled });
    }, [send]);

    const setShowRejectionCount = useCallback((enabled: boolean) => {
        send({ type: 'SET_SHOW_REJECTION_COUNT', enabled });
    }, [send]);

    const restartGame = useCallback(() => {
        send({ type: 'RESTART_GAME' });
    }, [send]);

    const disconnectVote = useCallback((endGame: boolean) => {
        send({ type: 'DISCONNECT_VOTE', endGame });
    }, [send]);

    // Cleanup ao desmontar
    useEffect(() => {
        return () => {
            shouldReconnectRef.current = false;
            clearReconnectTimeout();
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, [clearReconnectTimeout]);

    return {
        isConnected,
        isConnecting,
        isReconnecting,
        reconnectAttempt,
        connect,
        disconnect,
        send,
        leaveRoom,
        removePlayer,
        startGame,
        selectPlayer,
        submitTeam,
        vote,
        missionAction,
        setAnonymousVotes,
        setShowRejectionCount,
        restartGame,
        disconnectVote,
    };
}
