import { EVENT_SERVICE, type ILogger, Inject, Injectable, LOGGER_SERVICE, RPC_SERVICE } from '@aurora-mp/core';
import { EventService, RpcService } from '@aurora-mp/server';

@Injectable()
export class AppService {
    constructor(
        @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
        @Inject(EVENT_SERVICE) private readonly eventService: EventService,
        @Inject(RPC_SERVICE) private readonly rpc: RpcService,
    ) {}

    public async helloWorld(player: PlayerMp): Promise<void> {
        this.logger.info(`Hello ${player.name}!`);
        this.eventService.emit('app:hello');
    }
}
