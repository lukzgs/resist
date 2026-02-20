/**
 * Constantes compartilhadas entre cliente e servidor.
 * Fonte única de verdade (DRY) para limites e configurações.
 */

export const TIMER_LIMITS = {
    teamSelectionSeconds: { min: 30, max: 120, default: 120 },
    teamVoteSeconds: { min: 30, max: 120, default: 45 },
    missionVoteSeconds: { min: 5, max: 120, default: 30 },
} as const;

import { GameRules } from './types';

export const GAME_RULES_BY_COUNT: Record<number, GameRules> = {
    5: { spyCount: 2, missionSizes: [2, 3, 2, 3, 3], maxRejections: 3 },
    6: { spyCount: 2, missionSizes: [2, 3, 4, 3, 3], maxRejections: 3 },
    7: { spyCount: 3, missionSizes: [2, 3, 3, 4, 4], maxRejections: 5, twoFailsRequiredRound4: true },
    8: { spyCount: 3, missionSizes: [3, 3, 4, 4, 4], maxRejections: 5, twoFailsRequiredRound4: true, twoFailsRequiredRound5: true },
    9: { spyCount: 3, missionSizes: [3, 4, 4, 5, 4], maxRejections: 5, twoFailsRequiredRound4: true, twoFailsRequiredRound5: true },
    10: { spyCount: 3, missionSizes: [3, 4, 5, 5, 4], maxRejections: 5, twoFailsRequiredRound4: true },
} as const;

export const MIN_MISSIONS_TO_WIN = 3;
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ1234567890';
