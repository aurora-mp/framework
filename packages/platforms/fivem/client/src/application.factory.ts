import { ApplicationFactory, IApplication, Module, Type } from '@aurora-mp/core';
import { ClientModule } from '@aurora-mp/client';
import { FiveMClientDriver, FiveMClientDriverOptions } from './driver';
import { PlatformModule } from './platform.module';

/**
 * Creates and initializes an application specifically for the FiveM Client platform.
 *
 * @param rootModule The root module of the application.
 * @returns A promise that resolves to the initialized application instance.
 */
export async function createFiveMClientApplication(
    rootModule: Type,
    options?: FiveMClientDriverOptions,
): Promise<IApplication> {
    @Module({
        imports: [rootModule, PlatformModule, ClientModule],
    })
    class InternalRootModule {}

    const driver = new FiveMClientDriver(options).init();
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
