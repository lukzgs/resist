/**
 * useSession.ts
 * Responsabilidade única: persistência de sessão do jogador (localStorage + cookies).
 *
 * Princípio SRP: este módulo sabe APENAS como armazenar e recuperar sessões.
 * A lógica de conexão WebSocket NÃO pertence aqui.
 */

// ─── Constantes ────────────────────────────────────────────────────────────────
const SESSION_PREFIX = 'resist_session_';
const COOKIE_PREFIX = 'rs_';

// ─── Tipos ─────────────────────────────────────────────────────────────────────
interface StoredSession {
    sessionId: string;
    playerId: string;
    roomCode: string;
    playerName: string;
}

// ─── Chaves ────────────────────────────────────────────────────────────────────
function sessionKey(roomCode: string): string {
    return `${SESSION_PREFIX}${roomCode}`;
}

// ─── Cookie helpers (fallback para iOS Safari, que pode limpar localStorage) ──
function setCookie(roomCode: string, sessionId: string, playerId: string): void {
    const key = `${COOKIE_PREFIX}${roomCode}`;
    const value = encodeURIComponent(JSON.stringify({ sessionId, playerId }));
    const maxAge = 7 * 24 * 60 * 60; // 7 dias
    document.cookie = `${key}=${value}; max-age=${maxAge}; path=/; SameSite=Strict`;
}

function getCookie(roomCode: string): { sessionId: string; playerId: string } | null {
    try {
        const prefix = `${COOKIE_PREFIX}${roomCode}=`;
        const match = document.cookie.split('; ').find(c => c.startsWith(prefix));
        if (match) return JSON.parse(decodeURIComponent(match.substring(prefix.length)));
    } catch {
        console.warn('[Session] Erro ao ler cookie');
    }
    return null;
}

function clearCookie(roomCode?: string): void {
    if (roomCode) {
        document.cookie = `${COOKIE_PREFIX}${roomCode}=; max-age=0; path=/; SameSite=Strict`;
        return;
    }
    // Limpa todos os cookies resist
    document.cookie.split('; ')
        .filter(c => c.startsWith(COOKIE_PREFIX))
        .forEach(c => {
            const name = c.split('=')[0];
            document.cookie = `${name}=; max-age=0; path=/; SameSite=Strict`;
        });
}

// ─── API pública ───────────────────────────────────────────────────────────────

/** Salva ID de sessão no localStorage e em cookie (fallback iOS) */
export function saveSession(roomCode: string, playerName: string, sessionId: string, playerId: string): void {
    try {
        const session: StoredSession = { sessionId, playerId, roomCode, playerName };
        localStorage.setItem(sessionKey(roomCode), JSON.stringify(session));
    } catch {
        console.warn('[Session] Erro ao salvar no localStorage');
    }
    setCookie(roomCode, sessionId, playerId);
}

/** Retorna sessionId armazenado, com fallback para cookie */
export function getSessionId(roomCode: string): string | undefined {
    try {
        const raw = localStorage.getItem(sessionKey(roomCode));
        if (raw) return (JSON.parse(raw) as StoredSession).sessionId;
    } catch {
        console.warn('[Session] Erro ao ler sessionId do localStorage');
    }
    return getCookie(roomCode)?.sessionId;
}

/** Retorna playerId armazenado, com fallback para cookie */
export function getPlayerId(roomCode: string): string | undefined {
    try {
        const raw = localStorage.getItem(sessionKey(roomCode));
        if (raw) return (JSON.parse(raw) as StoredSession).playerId;
    } catch {
        console.warn('[Session] Erro ao ler playerId do localStorage');
    }
    return getCookie(roomCode)?.playerId;
}

/** Limpa sessão de uma sala (ou todas) */
export function clearSession(roomCode?: string): void {
    try {
        if (roomCode) {
            localStorage.removeItem(sessionKey(roomCode));
        } else {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k?.startsWith(SESSION_PREFIX)) keysToRemove.push(k);
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        }
    } catch {
        console.warn('[Session] Erro ao limpar localStorage');
    }
    clearCookie(roomCode);
}
