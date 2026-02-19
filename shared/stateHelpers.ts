import { GameState, Player, Mission } from './types';

/** Retorna o líder atual da rodada */
export function getLeader(state: GameState): Player {
    return state.players[state.leaderIndex];
}

/** Retorna a missão atual */
export function getCurrentMission(state: GameState): Mission {
    return state.missions[state.currentMissionIndex];
}
