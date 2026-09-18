import { EVENT_SERVICE, Global, Module, NUI_SERVICE, RPC_SERVICE } from '@aurora-mp/core';
import { EventService } from './services';
import { NuiService } from './services/nui.service';
import { RpcService } from './services/rpc.service';

/**
 * Provides shared client-side services.
 */
@Global()
@Module({
    providers: [
        {
            provide: EVENT_SERVICE,
            useClass: EventService,
        },
        {
            provide: RPC_SERVICE,
            useClass: RpcService,
        },
        {
            provide: NUI_SERVICE,
            useClass: NuiService,
        },
    ],
    exports: [EVENT_SERVICE, RPC_SERVICE, NUI_SERVICE],
})
export class ClientModule {}
