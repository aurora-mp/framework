import { Global, Module, LOGGER_SERVICE, PLATFORM_DRIVER, CONFIG_LOADER } from '@aurora-mp/core';
import { LoggerService, OmpConfigLoader } from './services/';
import { OmpServerDriver } from './driver';

/**
 * This internal module provides and exports the platform-specific services.
 * It is marked as @Global() so that its exports are available everywhere
 * in the application without needing to import this module explicitly.
 *
 * The key is the custom provider definition:
 * `{ provide: LOGGER_SERVICE, useClass: LoggerService }`
 * This tells the DI system: "When someone asks for the generic LOGGER_SERVICE token,
 * instantiate and provide an instance of the LoggerService class."
 */
@Global()
@Module({
    providers: [
        {
            provide: CONFIG_LOADER,
            useClass: OmpConfigLoader,
        },
        {
            provide: LOGGER_SERVICE,
            useClass: LoggerService,
        },
        {
            provide: PLATFORM_DRIVER,
            useClass: OmpServerDriver,
        },
    ],
    exports: [CONFIG_LOADER, LOGGER_SERVICE],
})
export class PlatformModule {}
