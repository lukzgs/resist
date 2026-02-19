import { GameState, Player, Mission } from './types';

/** Retorna o líder atual da rodada (undefined se leaderIndex inválido) */
export function getLeader(state: GameState): Player | undefined {
    return state.players[state.leaderIndex];
}

/** Retorna a missão atual */
export function getCurrentMission(state: GameState): Mission {
    return state.missions[state.currentMissionIndex];
}
