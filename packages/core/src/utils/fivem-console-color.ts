export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * FiveM's console (both client and server) uses Quake-style `^N` color
 * codes rather than ANSI escape sequences.
 */
const FIVEM_LEVEL_COLORS: Record<LogLevel, string> = {
    error: '^1',
    warn: '^3',
    info: '^5',
    debug: '^6',
};

const FIVEM_RESET = '^7';

export function colorizeFivemLevel(level: string, text: string): string {
    const code = FIVEM_LEVEL_COLORS[level as LogLevel] ?? FIVEM_RESET;
    return `${code}${text}${FIVEM_RESET}`;
}
