import { Injectable, type ILogger, CONFIG_SERVICE, type IConfigService, Inject } from '@aurora-mp/core';


//TODO: Convert winston logger to global and implement in all drivers
@Injectable()
export class LoggerService implements ILogger {
    private readonly isDebug: boolean;

    constructor(@Inject(CONFIG_SERVICE) private readonly config: IConfigService) {
        this.isDebug = this.config.get<boolean>('DEBUG', false);
    }

    public debug(message: string): void {
        if (this.isDebug) {
            console.debug(message);
        }
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
