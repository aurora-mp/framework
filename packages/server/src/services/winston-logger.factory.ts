import { createLogger, format, transports, type Logger } from 'winston';

/**
 * Options accepted by {@link createAuroraWinstonLogger}.
 *
 * @public
 */
export interface AuroraWinstonLoggerOptions {
    /** Initial level. Defaults to `'info'`. */
    readonly level?: string;
    /**
     * Label prepended to each log line, typically the platform name
     * (e.g. `'fivem-server'`, `'ragemp-server'`). When omitted, no label is
     * added.
     */
    readonly label?: string;
    /** Enable ANSI colors on the console transport. Defaults to `true`. */
    readonly colors?: boolean;
}

/**
 * Builds the shared Winston {@link Logger} used by every server platform
 * driver.
 *
 * @public
 */
export function createAuroraWinstonLogger(options: AuroraWinstonLoggerOptions = {}): Logger {
    const { level = 'info', label, colors = true } = options;

    const consoleFormat = format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        ...(label ? [format.label({ label })] : []),
        format.errors({ stack: true }),
        format.splat(),
        ...(colors ? [format.colorize()] : []),
        format.printf((info) => {
            const time = info['timestamp'] ?? '';
            const lbl = info['label'] ? ` [${info['label']}]` : '';
            const msg = info['stack'] ?? info.message;
            return `${time}${lbl} ${info.level}: ${msg}`;
        }),
    );

    return createLogger({
        level,
        transports: [new transports.Console({ format: consoleFormat })],
    });
}
