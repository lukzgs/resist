// Re-exporta GAME_RULES do shared para manter compatibilidade
export { GAME_RULES_BY_COUNT as GAME_RULES } from '../shared/constants';

// Helpers específicos do cliente
export const AVATAR_URL = (seed: number) => `https://picsum.photos/seed/${seed}/200`;
