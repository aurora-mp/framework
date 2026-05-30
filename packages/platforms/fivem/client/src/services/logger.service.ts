import { Injectable, type ILogger } from '@aurora-mp/core';

@Injectable()
export class LoggerService implements ILogger {
    public debug(message: string): void {
        console.debug(message);
    }

    public info(message: string): void {
        console.log(message);
    }

    public warn(message: string): void {
        console.warn(message);
    }

    public error(message: string | Error): void {
        console.error(message);
    }
}
