import { ApplicationFactory, Module, Type } from '@aurora-mp/core';
import { ClientModule } from '@aurora-mp/client';
import { FiveMClientDriver } from './driver';
import { PlatformModule } from './platform.module';

/**
 * Creates and initializes an application specifically for the FiveM Client platform.
 *
 * @param rootModule The root module of the application.
 * @returns A promise that resolves to the initialized application instance.
 */
export function createFiveMClientApplication(rootModule: Type) {
    @Module({
        imports: [rootModule, PlatformModule, ClientModule],
    })
    class InternalRootModule {}

    const driver = new FiveMClientDriver();
    return ApplicationFactory.create(InternalRootModule, driver);
}
