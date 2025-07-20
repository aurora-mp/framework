import { ApplicationFactory, Module, Type } from '@aurora-mp/core';
import { ServerModule } from '@aurora-mp/server';
import { OmpServerDriver } from './driver';
import { PlatformModule } from './platform.module';

/**
 * Creates and initializes an application specifically for the FiveM Server platform.
 * This function hides the complexity of creating and passing the platform driver.
 *
 * @param rootModule The root module of the application.
 * @returns A promise that resolves to the initialized application instance.
 */
export function createOmpApplication(rootModule: Type) {
    /**
     * We dynamically create a new root module that imports both
     * our internal platform module and the user's application module.
     * This makes the platform services (like the logger) available to the whole application
     * without the user having to do anything.
     */
    @Module({
        imports: [rootModule, PlatformModule, ServerModule],
    })
    class InternalRootModule {}

    const driver = new OmpServerDriver();
    return ApplicationFactory.create(InternalRootModule, driver);
}
