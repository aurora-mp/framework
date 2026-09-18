import { colorizeFivemLevel, Injectable, type ILogger } from '@aurora-mp/core';

const LABEL = '[fivem-client]';

@Injectable()
export class LoggerService implements ILogger {
    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
        console.log(`${colorizeFivemLevel(level, LABEL)} ${colorizeFivemLevel(level, level)}: ${colorizeFivemLevel(level, message)}`);
    }

    public debug(message: string): void {
        this.log('debug', message);
    }

    public info(message: string): void {
        this.log('info', message);
    }

    public warn(message: string): void {
        this.log('warn', message);
    }

    public error(message: string | Error): void {
        this.log('error', message instanceof Error ? message.stack ?? message.message : message);
    }
}
