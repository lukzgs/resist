/**
 * useGameActions.ts
 * Responsabilidade única: envio de comandos do jogo para o servidor via WebSocket.
 *
 * Princípio SRP: este hook sabe APENAS como formatar e enviar mensagens de jogo.
 * Ele não gerencia conexão, reconexão ou estado.
 *
 * Recebe um `send` callback do useSocketConnection como dependência (DIP).
 */

import { useCallback } from 'react';
import { TimerConfig } from '../types';

type SendFn = (message: object) => void;

export function useGameActions(send: SendFn) {
    const leaveRoom = useCallback(() => {
        send({ type: 'LEAVE_ROOM' });
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

    return {
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
