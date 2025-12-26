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

// Chave do localStorage para sessão
const SESSION_STORAGE_KEY = 'resist_session';

interface StoredSession {
    sessionId: string;
    roomCode: string;
    playerName: string;
}

// Gera um ID de sessão único
function generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Recupera ou cria sessão do localStorage
function getOrCreateSession(roomCode: string, playerName: string): string {
    try {
        const stored = localStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
            const session: StoredSession = JSON.parse(stored);
            // Se é a mesma sala e jogador, retorna sessionId existente
            if (session.roomCode === roomCode && session.playerName === playerName) {
                console.log('[Session] Sessão recuperada:', session.sessionId);
                return session.sessionId;
            }
        }
    } catch (e) {
        console.warn('[Session] Erro ao ler sessão:', e);
    }

    // Cria nova sessão
    const newSessionId = generateSessionId();
    const newSession: StoredSession = { sessionId: newSessionId, roomCode, playerName };
    try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
        console.log('[Session] Nova sessão criada:', newSessionId);
    } catch (e) {
        console.warn('[Session] Erro ao salvar sessão:', e);
    }
    return newSessionId;
}

// Limpa sessão do localStorage
function clearSession() {
    try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        console.log('[Session] Sessão limpa');
    } catch (e) {
        console.warn('[Session] Erro ao limpar sessão:', e);
    }
}

interface UsePartySocketOptions {
    roomCode: string;
    playerName: string;
    avatarSeed: number;
    onStateUpdate: (state: GameState) => void;
    onError: (message: string) => void;
    onPlayerJoined?: (name: string) => void;
    onPlayerLeft?: (name: string) => void;
    onConnectionChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting') => void;
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
    removePlayer: () => void;
    startGame: () => void;
    selectPlayer: (playerId: string) => void;
    submitTeam: () => void;
    vote: (approve: boolean) => void;
    missionAction: (success: boolean) => void;
    setAnonymousVotes: (enabled: boolean) => void;
}

export function usePartySocket(options: UsePartySocketOptions): UsePartySocketReturn {
    const {
        roomCode,
        playerName,
        avatarSeed,
        onStateUpdate,
        onError,
        onPlayerJoined,
        onPlayerLeft,
        onConnectionChange
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

    // Atualiza as refs quando os valores mudam
    useEffect(() => {
        lastRoomCodeRef.current = roomCode;
        lastPlayerNameRef.current = playerName;
        lastAvatarSeedRef.current = avatarSeed;
    }, [roomCode, playerName, avatarSeed]);

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
            console.log('Já existe uma conexão ativa');
            return;
        }

        const currentRoomCode = lastRoomCodeRef.current;
        const currentPlayerName = lastPlayerNameRef.current;
        const currentAvatarSeed = lastAvatarSeedRef.current;

        if (!currentRoomCode) {
            console.log('Código da sala não definido');
            return;
        }

        shouldReconnectRef.current = true;
        setIsConnecting(true);
        onConnectionChange?.('connecting');

        try {
            console.log(`[WS] Conectando à sala ${currentRoomCode}...`);

            const socket = new PartySocket({
                host: PARTYKIT_HOST,
                room: currentRoomCode,
            });

            socket.addEventListener('open', () => {
                console.log('[WS] Conectado!');
                setIsConnected(true);
                setIsConnecting(false);
                setIsReconnecting(false);
                setReconnectAttempt(0);
                onConnectionChange?.('connected');

                // Gera ou recupera sessionId do localStorage
                const sessionId = getOrCreateSession(currentRoomCode, currentPlayerName);

                // Envia JOIN ao conectar com sessionId
                socket.send(JSON.stringify({
                    type: 'JOIN',
                    name: currentPlayerName,
                    avatarSeed: currentAvatarSeed,
                    sessionId,
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
                            break;
                        case 'PLAYER_JOINED':
                            onPlayerJoined?.(data.name);
                            break;
                        case 'PLAYER_LEFT':
                            onPlayerLeft?.(data.name);
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
    }, [reconnectAttempt, getReconnectDelay, onStateUpdate, onError, onPlayerJoined, onPlayerLeft, onConnectionChange]);

    // Desconecta intencionalmente (não tenta reconectar)
    const disconnect = useCallback(() => {
        console.log('[WS] Desconectando...');
        shouldReconnectRef.current = false;
        clearReconnectTimeout();

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
        removePlayer,
        startGame,
        selectPlayer,
        submitTeam,
        vote,
        missionAction,
        setAnonymousVotes,
    };
}
