import {
    type ILogger,
    Inject,
    Injectable,
    type IPlatformDriver,
    type IWebView,
    LOGGER_SERVICE,
    NUI_ID,
    type OnAppInit,
    PLATFORM_DRIVER,
} from '@aurora-mp/core';

/**
 * Messaging surface for the single-instance NUI that platforms like FiveM
 * expose per resource. The page itself is declared in the platform manifest
 * (e.g. `ui_page` in `fxmanifest.lua`)
 */
@Injectable()
export class NuiService implements OnAppInit {
    private handle?: IWebView;

    constructor(
        @Inject(PLATFORM_DRIVER) private readonly platformDriver: IPlatformDriver,
        @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
    ) {}

    public onAppInit(): void {
        if (!this.platformDriver.createNuiDriver) {
            this.logger.warn('[Aurora] Current platform driver does not expose an NUI.');
            return;
        }
        try {
            this.handle = this.platformDriver.createNuiDriver(NUI_ID, false, false);
            this.logger.info(`[Aurora] NUI driver ready (id=${String(NUI_ID)}).`);
        } catch (err) {
            const detail = err instanceof Error ? err.stack ?? err.message : String(err);
            this.logger.error(`[Aurora] createNuiDriver threw during init: ${detail}`);
        }
    }

    public emit(eventName: string, ...args: unknown[]): void {
        if (!this.handle) {
            this.logger.warn(`[Aurora] Cannot emit "${eventName}", NUI not initialized.`);
            return;
        }
        this.handle.emit(eventName, ...args);
    }

    public invoke<T = unknown>(eventName: string, ...args: unknown[]): Promise<T> {
        if (!this.handle) {
          const error = new Error(`[Aurora] Cannot invoke NUI because it is not initialized.`);
          this.logger.warn(error.message);
          throw error;
        }
        return this.handle.invoke<T>(eventName, ...args);
    }
}
