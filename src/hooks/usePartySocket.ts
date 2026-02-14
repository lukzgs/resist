import { useState, useCallback, useEffect, useRef } from 'react';
import PartySocket from 'partysocket';
import { GameState, TimerConfig } from '../types';

// URL do servidor PartyKit (desenvolvimento ou produção)
// @ts-ignore - Vite injects this
const PARTYKIT_HOST = (import.meta as any).env?.VITE_PARTYKIT_HOST || 'localhost:1999';

// Configuração de reconexão
const RECONNECT_DELAY_MS = 1000; // Delay inicial entre tentativas
const MAX_RECONNECT_DELAY_MS = 30000; // Delay máximo (30s)
const MAX_RECONNECT_ATTEMPTS = 10; // Tentativas máximas antes de desistir
const CONNECTION_TIMEOUT_MS = 15000; // Timeout de conexão (15s)

// Reconexão silenciosa para mobile
const SILENT_RECONNECT_ATTEMPTS = 3; // Tentativas invisíveis antes de mostrar UI
const SILENT_RECONNECT_DELAY_MS = 2000; // Delay entre tentativas silenciosas (2s)

// Health check timeout (2 segundos)
const HEALTH_CHECK_TIMEOUT_MS = 2000;

// Verifica se o servidor está disponível antes de conectar
export async function checkServerHealth(): Promise<boolean> {
    try {
        const protocol = PARTYKIT_HOST.includes('localhost') ? 'http' : 'https';
        const url = `${protocol}://${PARTYKIT_HOST}/party/health`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response.ok;
    } catch (e) {
        // Servidor não disponível ou timeout
        return false;
    }
}

// Gera código de sala chamando o registry (controla limite de salas)
export async function generateRoomCode(roomName: string = '', isPublic: boolean = true): Promise<string | null> {
    try {
        const protocol = PARTYKIT_HOST.includes('localhost') ? 'http' : 'https';
        const url = `${protocol}://${PARTYKIT_HOST}/parties/registry/main/register`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

        const response = await fetch(url, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: roomName, isPublic })
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return data.code || null;
        } else if (response.status === 429) {
            // Limite de salas atingido
            const data = await response.json();
            throw new Error(data.error || 'Limite de salas atingido');
        }
        return null;
    } catch (e) {
        console.error('[RoomCode] Erro ao gerar código:', e);
        throw e;  // Re-throw para que o caller possa tratar
    }
}

// Tipo para salas públicas retornadas pelo registry
export interface PublicRoom {
    code: string;
    name: string;  // Nome personalizado da sala
    playerCount: number;
    createdAt: number;
    expiresAt: number;
    expiresIn: number;  // Milissegundos restantes
    isClosingSoon: boolean;  // Menos de 1 minuto
}

// Lista salas públicas disponíveis
export async function getPublicRooms(): Promise<PublicRoom[]> {
    try {
        const protocol = PARTYKIT_HOST.includes('localhost') ? 'http' : 'https';
        const url = `${protocol}://${PARTYKIT_HOST}/parties/registry/main/rooms`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return data.rooms || [];
        }
        return [];
    } catch (e) {
        console.error('[Registry] Erro ao listar salas:', e);
        return [];
    }
}

// Chave do localStorage para sessão - agora única por sala
const SESSION_STORAGE_PREFIX = 'resist_session_';

interface StoredSession {
    sessionId: string;
    playerId: string;
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
function saveSession(roomCode: string, playerName: string, sessionId: string, playerId: string) {
    try {
        const key = getSessionKey(roomCode);
        const session: StoredSession = { sessionId, playerId, roomCode, playerName };
        localStorage.setItem(key, JSON.stringify(session));
    } catch (e) {
        console.warn('[Session] Erro ao salvar sessão:', e);
    }
}

// Obtém playerId armazenado
export function getStoredPlayerId(roomCode: string): string | undefined {
    try {
        const key = getSessionKey(roomCode);
        const stored = localStorage.getItem(key);
        if (stored) {
            const session: StoredSession = JSON.parse(stored);
            return session.playerId;
        }
    } catch (e) {
        console.warn('[Session] Erro ao ler playerId:', e);
    }
    return undefined;
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
    roomName?: string;  // Nome da sala ao criar
    onStateUpdate: (state: GameState) => void;
    onError: (message: string) => void;
    onPlayerJoined?: (name: string) => void;
    onPlayerLeft?: (name: string) => void;
    onConnectionChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting') => void;
    onRoomClosed?: () => void;
    onKicked?: () => void;  // Chamado quando jogador é removido pelo host
    onFatalError?: () => void;  // Chamado em erros fatais que impedem conexão (sala não existe, cheia, etc.)
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
    removePlayer: (playerId: string) => void;
    startGame: (timerConfig?: TimerConfig) => void;
    selectPlayer: (playerId: string) => void;
    submitTeam: () => void;
    vote: (approve: boolean) => void;
    missionAction: (success: boolean) => void;
    setAnonymousVotes: (enabled: boolean) => void;
    setShowRejectionCount: (enabled: boolean) => void;
    setPublic: (enabled: boolean) => void;
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
        onRoomClosed,
        onKicked,
        onFatalError
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);

    const socketRef = useRef<PartySocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

    // Limpa timeout de conexão
    const clearConnectionTimeout = useCallback(() => {
        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
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

        // Só reseta shouldReconnect quando é conexão inicial (não durante reconexões)
        // Isso preserva o flag false setado quando recebe erro fatal como "sala não encontrada"
        if (reconnectAttempt === 0) {
            shouldReconnectRef.current = true;
        }
        setIsConnecting(true);
        onConnectionChange?.('connecting');

        try {
            const socket = new PartySocket({
                host: PARTYKIT_HOST,
                room: currentRoomCode,
            });

            // Timeout de conexão: se não conectar em 15s, falha
            connectionTimeoutRef.current = setTimeout(() => {
                console.log('[WS] Timeout de conexão atingido');
                if (socketRef.current && !isConnected) {
                    socketRef.current.close();
                    socketRef.current = null;
                    setIsConnecting(false);
                    setIsReconnecting(false);
                    onError('Tempo limite de conexão excedido. Verifique sua internet.');
                    onConnectionChange?.('disconnected');
                }
            }, CONNECTION_TIMEOUT_MS);

            socket.addEventListener('open', () => {
                clearConnectionTimeout(); // Limpa timeout pois conectou
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
                    roomName: options.roomName,
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
                                data.message.includes('not found') ||
                                data.message.includes('removido')) {
                                shouldReconnectRef.current = false;
                                clearReconnectTimeout();

                                // Fecha socket imediatamente para impedir reconexão
                                if (socketRef.current) {
                                    socketRef.current.close();
                                    socketRef.current = null;
                                }

                                // Se foi kickado, limpa sessão e notifica
                                if (data.message.includes('removido')) {
                                    clearSession(lastRoomCodeRef.current);
                                    onKicked?.();
                                } else {
                                    // Outros erros fatais (sala não existe, cheia, etc.)
                                    onFatalError?.();
                                }
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
                                saveSession(
                                    lastRoomCodeRef.current,
                                    lastPlayerNameRef.current,
                                    (data as any).sessionId,
                                    (data as any).playerId
                                );
                                console.log('[Session] Sessão segura estabelecida, playerId:', (data as any).playerId);
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

                // Código 4001 = kicked pelo host - impedir reconexão imediatamente
                if (event.code === 4001) {
                    shouldReconnectRef.current = false;
                    clearReconnectTimeout();
                    clearSession(lastRoomCodeRef.current);
                    setIsConnecting(false);
                    setIsReconnecting(false);
                    setReconnectAttempt(0);
                    onConnectionChange?.('disconnected');
                    onKicked?.();
                    return;
                }

                // Tenta reconectar se não foi desconexão intencional
                if (shouldReconnectRef.current && reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
                    const nextAttempt = reconnectAttempt + 1;

                    // Reconexão silenciosa: primeiras N tentativas são invisíveis
                    const isSilentReconnect = nextAttempt <= SILENT_RECONNECT_ATTEMPTS;
                    const delay = isSilentReconnect ? SILENT_RECONNECT_DELAY_MS : getReconnectDelay(nextAttempt - SILENT_RECONNECT_ATTEMPTS);

                    if (isSilentReconnect) {
                        console.log(`[WS] Reconexão silenciosa ${nextAttempt}/${SILENT_RECONNECT_ATTEMPTS} em ${delay}ms`);
                    } else {
                        console.log(`[WS] Reconexão visível (tentativa ${nextAttempt - SILENT_RECONNECT_ATTEMPTS}/${MAX_RECONNECT_ATTEMPTS - SILENT_RECONNECT_ATTEMPTS}) em ${delay}ms`);
                        // Só mostra UI de reconexão após tentativas silenciosas
                        setIsReconnecting(true);
                        onConnectionChange?.('reconnecting');
                    }

                    setReconnectAttempt(nextAttempt);

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

    const removePlayer = useCallback((playerId: string) => {
        send({ type: 'REMOVE_PLAYER', playerId });
    }, [send]);

    const startGame = useCallback((timerConfig?: TimerConfig) => {
        send({ type: 'START_GAME', timerConfig });
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

    const setPublic = useCallback((enabled: boolean) => {
        send({ type: 'SET_PUBLIC', enabled });
    }, [send]);

    const restartGame = useCallback(() => {
        send({ type: 'RESTART_GAME' });
    }, [send]);

    const disconnectVote = useCallback((endGame: boolean) => {
        send({ type: 'DISCONNECT_VOTE', endGame });
    }, [send]);

    // Handler para visibilitychange (Safari/iOS suspende WebSocket em background)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Página ficou visível novamente
                console.log('[WS] Página visível - verificando conexão...');

                const socket = socketRef.current;

                // Se não há socket ou está fechado/fechando, tenta reconectar
                if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
                    if (shouldReconnectRef.current && lastRoomCodeRef.current) {
                        console.log('[WS] Socket morto após voltar à aba - reconectando...');
                        setIsReconnecting(true);
                        onConnectionChange?.('reconnecting');
                        connect();
                    }
                } else if (socket.readyState === WebSocket.OPEN) {
                    // iOS Safari: Socket pode parecer aberto mas estar "morto"
                    // Força reconexão imediata em dispositivos móveis para garantir conexão viva
                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

                    if (isMobile && shouldReconnectRef.current && lastRoomCodeRef.current) {
                        console.log('[WS] Mobile detectado - forçando reconexão para garantir conexão viva');
                        // Fecha socket atual e reconecta
                        socketRef.current = null;
                        socket.close();
                        setIsReconnecting(true);
                        onConnectionChange?.('reconnecting');
                        // Pequeno delay para garantir que o close foi processado
                        setTimeout(() => {
                            if (shouldReconnectRef.current) {
                                connect();
                            }
                        }, 100);
                    } else {
                        console.log('[WS] Socket aparenta estar conectado');
                    }
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [connect, onConnectionChange]);

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
        setPublic,
        restartGame,
        disconnectVote,
    };
}
