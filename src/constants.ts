import { GameConfig } from './types';

// Key: Number of players
export const GAME_RULES: Record<number, GameConfig> = {
  5: {
    playerCount: 5,
    spyCount: 2,
    missionSizes: [2, 3, 2, 3, 3],
  },
  6: {
    playerCount: 6,
    spyCount: 2,
    missionSizes: [2, 3, 4, 3, 4],
  },
  7: {
    playerCount: 7,
    spyCount: 3,
    missionSizes: [2, 3, 3, 4, 4],
    twoFailsRequiredRound4: true,
  },
  8: {
    playerCount: 8,
    spyCount: 3,
    missionSizes: [3, 4, 4, 5, 5],
    twoFailsRequiredRound4: true,
  },
  9: {
    playerCount: 9,
    spyCount: 3,
    missionSizes: [3, 4, 4, 5, 5],
    twoFailsRequiredRound4: true,
  },
  10: {
    playerCount: 10,
    spyCount: 4,
    missionSizes: [3, 4, 4, 5, 5],
    twoFailsRequiredRound4: true,
  },
};

export const AVATAR_URL = (seed: number) => `https://picsum.photos/seed/${seed}/200`;
