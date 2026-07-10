import { createLogger, format, transports, addColors } from 'winston';


const { combine, timestamp, printf, colorize } = format;

addColors({
    error: 'red',
    warn: 'yellow',
    info: 'blue',
    debug: 'magenta',
});

const consoleTransport = new transports.Console({
    format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        printf(({ timestamp, level, message }) => `[${timestamp}] [${level}] ${message}`),
    ),
});

export const winstonLogger = createLogger({
    level: 'debug',
    transports: [consoleTransport],
});
