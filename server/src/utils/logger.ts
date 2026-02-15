// Logger utilitario com ANSI colors para terminal
// Formato: [timestamp] [ROOM:CODE] [TAG] mensagem

// ANSI color codes
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const BLUE = '\x1b[34m';
const BOLD_YELLOW = '\x1b[1;33m';
const BOLD_RED = '\x1b[1;31m';

function formatTimestamp(): string {
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

function formatLine(roomCode: string, tagColor: string, tag: string, message: string): string {
    const ts = `${DIM}[${formatTimestamp()}]${RESET}`;
    const room = roomCode ? ` ${CYAN}[ROOM:${roomCode}]${RESET}` : '';
    const tagStr = ` ${tagColor}[${tag}]${RESET}`;
    return `${ts}${room}${tagStr} ${message}`;
}

export const log = {
    player(roomCode: string, message: string): void {
        console.log(formatLine(roomCode, GREEN, 'PLAYER', message));
    },

    game(roomCode: string, message: string): void {
        console.log(formatLine(roomCode, YELLOW, 'GAME', message));
    },

    disconnect(roomCode: string, message: string): void {
        console.log(formatLine(roomCode, RED, 'DISCONNECT', message));
    },

    timer(roomCode: string, message: string): void {
        console.log(formatLine(roomCode, MAGENTA, 'TIMER', message));
    },

    system(roomCode: string, message: string): void {
        console.log(formatLine(roomCode, BLUE, 'SYSTEM', message));
    },

    registry(message: string): void {
        const ts = `${DIM}[${formatTimestamp()}]${RESET}`;
        console.log(`${ts} ${BOLD}[REGISTRY]${RESET} ${message}`);
    },

    warn(roomCode: string, message: string): void {
        console.warn(formatLine(roomCode, BOLD_YELLOW, 'WARN', message));
    },

    error(roomCode: string, message: string, err?: unknown): void {
        const errMsg = err instanceof Error ? err.message : (err ? String(err) : '');
        const suffix = errMsg ? `: ${errMsg}` : '';
        console.error(formatLine(roomCode, BOLD_RED, 'ERROR', `${message}${suffix}`));
    },
};
