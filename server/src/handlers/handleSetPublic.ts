// Handler para SET_PUBLIC

import type * as Party from "partykit/server";
import { Phase } from '../types';
import { getPlayerByConnection } from '../game/state';
import { GameHandlerContext } from './gameHandlers';

/**
 * Processa SET_PUBLIC — altera visibilidade da sala (apenas host no lobby)
 */
export function handleSetPublic(ctx: GameHandlerContext, conn: Party.Connection, enabled: boolean): void {
    if (ctx.gameState.phase !== Phase.LOBBY) return;

    const player = getPlayerByConnection(ctx.gameState, ctx.connections, conn.id);
    if (!player?.isHost) return;

    ctx.gameState.isPublic = enabled;
    ctx.broadcastState();
}
