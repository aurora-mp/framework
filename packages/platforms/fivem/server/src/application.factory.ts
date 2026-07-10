import { ApplicationFactory, IApplication, Module, Type } from '@aurora-mp/core';
import { ServerModule } from '@aurora-mp/server';
import { FiveMServerDriver, FiveMServerDriverOptions } from './driver';
import { PlatformModule } from './platform.module';

/**
 * Creates and initializes an application specifically for the FiveM Server platform.
 * This function hides the complexity of creating and passing the platform driver.
 *
 * @param rootModule The root module of the application.
 * @returns A promise that resolves to the initialized application instance.
 */
export async function createFiveMApplication(
    rootModule: Type,
    options?: FiveMServerDriverOptions,
): Promise<IApplication> {
    @Module({
        imports: [rootModule, PlatformModule, ServerModule],
    })
    class InternalRootModule {}

    const driver = new FiveMServerDriver(options).init();
    const app = await ApplicationFactory.create(InternalRootModule, driver);

    const resourceName = GetCurrentResourceName();
    on('onResourceStop', (stopped: string) => {
        if (stopped !== resourceName) return;
        void (async () => {
            try {
                await app.close('onResourceStop');
            } catch (err) {
                console.error('[Aurora] Error during app.close():', err);
            } finally {
                driver.dispose();
            }
        })();
    });

    return app;
}
