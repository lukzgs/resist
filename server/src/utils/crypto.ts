// Funções criptográficas seguras

/**
 * Gera bytes aleatórios seguros usando crypto
 */
export function getSecureRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
}

/**
 * Gera ID único seguro (8 caracteres alfanuméricos)
 */
export function generateId(): string {
    const bytes = getSecureRandomBytes(6);
    let result = '';
    for (const byte of bytes) {
        result += byte.toString(36).padStart(2, '0');
    }
    return result.slice(0, 8);
}

/**
 * Gera UUID seguro (compatível com diversos ambientes)
 */
export function generateUUID(): string {
    // Tenta usar crypto.randomUUID nativo (Node.js 19+, Cloudflare Workers, Browsers)
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }

    // Fallback seguro usando crypto.getRandomValues
    const bytes = getSecureRandomBytes(16);
    // Define versão 4 (random) e variante (10xx)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;  // versão 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80;  // variante

    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Shuffle array (Fisher-Yates) - usa crypto para aleatoriedade
 */
export function shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    const randomBytes = getSecureRandomBytes(arr.length * 4);
    for (let i = arr.length - 1; i > 0; i--) {
        // Usa 4 bytes para gerar número aleatório com boa distribuição
        const randomValue = (randomBytes[i * 4] << 24 | randomBytes[i * 4 + 1] << 16 |
            randomBytes[i * 4 + 2] << 8 | randomBytes[i * 4 + 3]) >>> 0;
        const j = randomValue % (i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Gera código de sala seguro (6 caracteres alfanuméricos)
 * Usa caracteres que não são facilmente confundidos (sem I/1/O/0)
 */
export function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = getSecureRandomBytes(6);
    let code = '';
    for (const byte of bytes) {
        code += chars[byte % chars.length];
    }
    return code;
}
