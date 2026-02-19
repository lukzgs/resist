// Message Router — substitui o switch/case do onMessage
// Cada handler é registrado declarativamente com guards automáticos

import type * as Party from "partykit/server";
import { ClientMessage } from '../types';
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
} from './gameHandlers';
import {
    handleJoin,
    handleLeaveRoom,
    handleRemovePlayer,
    HandlerContext,
} from './joinHandler';
import {
    handleDisconnectVote,
    DisconnectHandlerContext,
} from './disconnectHandlers';
import { handleSetPublic } from './handleSetPublic';

// Contextos disponíveis para os handlers
export interface ServerContexts {
    getJoinContext: () => HandlerContext;
    getGameContext: () => GameHandlerContext;
    getDisconnectContext: () => DisconnectHandlerContext;
    hasGameState: () => boolean;
    updateActivity: () => void;
    cancelRoomClosure: () => void;
}

interface MessageHandlerEntry {
    requiresGame: boolean;
    updatesActivity: boolean;
    handle: (contexts: ServerContexts, sender: Party.Connection, data: any) => void;
}

const MESSAGE_HANDLERS: Record<ClientMessage['type'], MessageHandlerEntry> = {
    JOIN: {
        requiresGame: false,
        updatesActivity: false,
        handle: (ctx, sender, data) =>
            handleJoin(ctx.getJoinContext(), sender, data.name, data.avatarSeed, data.sessionId, data.isCreating, data.roomName),
    },
    LEAVE_ROOM: {
        requiresGame: false,
        updatesActivity: false,
        handle: (ctx, sender) =>
            handleLeaveRoom(ctx.getJoinContext(), sender),
    },
    REMOVE_PLAYER: {
        requiresGame: true,
        updatesActivity: false,
        handle: (ctx, sender, data) =>
            handleRemovePlayer(ctx.getJoinContext(), sender, data.playerId),
    },
    START_GAME: {
        requiresGame: true,
        updatesActivity: false,
        handle: (ctx, sender, data) =>
            handleStartGame(ctx.getGameContext(), sender, data.timerConfig),
    },
    SELECT_PLAYER: {
        requiresGame: true,
        updatesActivity: true,
        handle: (ctx, sender, data) =>
            handleSelectPlayer(ctx.getGameContext(), sender, data.playerId),
    },
    SUBMIT_TEAM: {
        requiresGame: true,
        updatesActivity: true,
        handle: (ctx, sender) =>
            handleSubmitTeam(ctx.getGameContext(), sender),
    },
    VOTE: {
        requiresGame: true,
        updatesActivity: true,
        handle: (ctx, sender, data) =>
            handleVote(ctx.getGameContext(), sender, data.approve),
    },
    MISSION_ACTION: {
        requiresGame: true,
        updatesActivity: true,
        handle: (ctx, sender, data) =>
            handleMissionAction(ctx.getGameContext(), sender, data.success),
    },
    SET_ANONYMOUS_VOTES: {
        requiresGame: true,
        updatesActivity: false,
        handle: (ctx, sender, data) =>
            handleSetAnonymousVotes(ctx.getGameContext(), sender, data.enabled),
    },
    SET_SHOW_REJECTION_COUNT: {
        requiresGame: true,
        updatesActivity: false,
        handle: (ctx, sender, data) =>
            handleSetShowRejectionCount(ctx.getGameContext(), sender, data.enabled),
    },
    RESTART_GAME: {
        requiresGame: true,
        updatesActivity: false,
        handle: (ctx, sender) =>
            handleRestartGame(ctx.getGameContext(), sender, ctx.cancelRoomClosure),
    },
    SET_PUBLIC: {
        requiresGame: true,
        updatesActivity: false,
        handle: (ctx, sender, data) =>
            handleSetPublic(ctx.getGameContext(), sender, data.enabled),
    },
    DISCONNECT_VOTE: {
        requiresGame: true,
        updatesActivity: false,
        handle: (ctx, sender, data) =>
            handleDisconnectVote(ctx.getDisconnectContext(), sender, data.endGame),
    },
};

/**
 * Despacha mensagem para o handler correto.
 * Aplica guards automáticos (requiresGame) e chama updateActivity quando necessário.
 */
export function dispatchMessage(
    contexts: ServerContexts,
    sender: Party.Connection,
    data: ClientMessage,
): void {
    const entry = MESSAGE_HANDLERS[data.type];
    if (!entry) return;

    if (entry.requiresGame && !contexts.hasGameState()) return;

    entry.handle(contexts, sender, data);

    if (entry.updatesActivity) {
        contexts.updateActivity();
    }
}
