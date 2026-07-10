import {
    CONFIG_SERVICE,
    Inject,
    Injectable,
} from '@aurora-mp/core';
import { WinstonLoggerService } from '@aurora-mp/server';

type ConfigService = {
    get<T = any>(key: string, defaultValue?: T): T;
};

@Injectable()
export class LoggerService extends WinstonLoggerService {
    constructor(@Inject(CONFIG_SERVICE) config: ConfigService) {
        super(config, {});
    }
}
