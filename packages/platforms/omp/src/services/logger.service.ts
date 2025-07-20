import { Injectable, type ILogger, CONFIG_SERVICE, type IConfigService, Inject } from '@aurora-mp/core';
import { omp } from '@omp-node/core';

@Injectable()
export class LoggerService implements ILogger {
    private readonly isDebug: boolean;

    constructor(@Inject(CONFIG_SERVICE) private readonly config: IConfigService) {
        this.isDebug = this.config.get<boolean>('DEBUG', false);
    }

    public debug(message: string): void {
        if (this.isDebug) {
            omp.log(message);
        }
    }

    public info(message: string): void {
        omp.log(message);
    }

    public warn(message: string): void {
        omp.log(message);
    }

    public error(message: string | Error): void {
        omp.log(message);
    }
}
