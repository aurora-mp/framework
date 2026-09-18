import { Global, Module, LOGGER_SERVICE, PLATFORM_DRIVER } from '@aurora-mp/core';
import { LoggerService } from './services/';
import { FiveMClientDriver } from './driver';

@Global()
@Module({
    providers: [
        {
            provide: LOGGER_SERVICE,
            useClass: LoggerService,
        },
        {
            provide: PLATFORM_DRIVER,
            useClass: FiveMClientDriver,
        },
        /* 
          TODO: Idk shit about fivem, 
          do I need to implement specified services such as VoiceService?
        */
    ],
    exports: [  LOGGER_SERVICE],
})
export class PlatformModule {}
