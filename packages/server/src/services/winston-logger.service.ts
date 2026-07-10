import {
    CONFIG_SERVICE,
    Inject,
    Injectable,
    type ILogger,
} from '@aurora-mp/core';
import type { Logger } from 'winston';
import {
    createAuroraWinstonLogger,
    type AuroraWinstonLoggerOptions,
} from './winston-logger.factory';

type ConfigService = {
    get<T = any>(key: string, defaultValue?: T): T;
};

/**
 * Shared {@link ILogger} implementation backed by Winston. Each server
 * platform driver instantiates a subclass (or provides this class directly)
 * with its own {@link AuroraWinstonLoggerOptions.label}.
 *
 * @public
 */
@Injectable()
export class WinstonLoggerService implements ILogger {
    protected readonly logger: Logger;

    constructor(
        @Inject(CONFIG_SERVICE) config: ConfigService,
        options: AuroraWinstonLoggerOptions = {},
    ) {
        const isDebug = config.get<boolean>('DEBUG', false);
        this.logger = createAuroraWinstonLogger({
            ...options,
            level: options.level ?? (isDebug ? 'debug' : 'info'),
        });
    }

    public debug(message: string): void {
        this.logger.debug(message);
    }

    public info(message: string): void {
        this.logger.info(message);
    }

    public warn(message: string): void {
        this.logger.warn(message);
    }

    public error(message: string | Error): void {
        if (message instanceof Error) {
            this.logger.error(message.stack ?? message.message);
        } else {
            this.logger.error(message);
        }
    }
}
