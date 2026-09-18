import { colorizeFivemLevel } from '@aurora-mp/core';
import { addColors, createLogger, format, transports, type Logger } from 'winston';

const LEVEL_SYMBOL = Symbol.for('level');
const MESSAGE_SYMBOL = Symbol.for('message');

/**
 * Console transport that routes through `console.*` methods instead of writing
 * raw to `process.stdout`. FiveM's fxserver only decorates output with the
 * `[script:<resource>]` prefix and honors `^N` color codes when writes come
 * through `console.log/info/warn/error`; direct stdout writes bypass that layer
 * and land under a generic `Debug:` heading with no colors.
 */
class FivemConsoleTransport extends transports.Console {
    public override log(info: Record<PropertyKey, unknown>, next: () => void): void {
        setImmediate(() => this.emit('logged', info));

        const line = String(info[MESSAGE_SYMBOL] ?? '');
        const level = String(info[LEVEL_SYMBOL] ?? info['level'] ?? 'info');

        // fxserver's Node runtime maps each console method to a labelled
        // channel: `console.info` prepends `Info:`, `console.warn` prepends
        // `Warning:`, `console.error` prepends `Error:`, and `console.debug`
        // even leaks a stray ANSI sequence. Only `console.log` yields a clean
        // `[   script:<resource>] <msg>` line, so we route everything through
        // it and let winston's own `^N`-colored level indicator (produced by
        // the printf) do the visual differentiation.
        //
        // The `level` param is intentionally unused; we keep it so the switch
        // above can be reintroduced if fxserver ever changes this behavior.
        void level;
        console.log(line);

        next();
    }
}

addColors({
    error: 'red',
    warn: 'yellow',
    info: 'blue',
    debug: 'magenta',
});

/**
 * Options accepted by {@link createAuroraWinstonLogger}.
 *
 * @public
 */
export interface AuroraWinstonLoggerOptions {
    /** Initial level. Defaults to `'info'`. */
    readonly level?: string;
    /** Enable colors on the console transport. Defaults to `true`. */
    readonly colors?: boolean;
    /**
     * Use FiveM's `^N` color codes instead of ANSI escapes. Only meaningful
     * when running inside the fxserver console, which strips ANSI. Defaults
     * to `false`.
     */
    readonly useFivemColors?: boolean;
}

/**
 * Builds the shared Winston {@link Logger} used by every server platform
 * driver.
 *
 * @public
 */
export function createAuroraWinstonLogger(options: AuroraWinstonLoggerOptions = {}): Logger {
    const { level = 'info', colors = true, useFivemColors = false } = options;

    const consoleFormat = format.combine(
        format.errors({ stack: true }),
        format.splat(),
        ...(colors && !useFivemColors ? [format.colorize({ all: true })] : []),
        format.printf((info) => {
            const msg = info['stack'] ?? info.message;

            if (colors && useFivemColors) {
                return `${colorizeFivemLevel(info.level, info.level)}: ${colorizeFivemLevel(info.level, String(msg))}`;
            }

            return `${info.level}: ${msg}`;
        }),
    );

    const transport = useFivemColors
        ? new FivemConsoleTransport({ format: consoleFormat })
        : new transports.Console({ format: consoleFormat });

    return createLogger({
        level,
        transports: [transport],
    });
}
