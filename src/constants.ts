// Re-exporta GAME_RULES do shared para manter compatibilidade
export { GAME_RULES } from '../shared/types';

// Helpers específicos do cliente
export const AVATAR_URL = (seed: number) => `https://picsum.photos/seed/${seed}/200`;
