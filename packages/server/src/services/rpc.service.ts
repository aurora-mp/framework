import {
    type ILogger,
    Inject,
    Injectable,
    type IPlatformDriver,
    LOGGER_SERVICE,
    PLATFORM_DRIVER,
    WebViewEvents,
} from '@aurora-mp/core';

@Injectable()
export class RpcService<TPlayer = any> {
    /**
     * @param platformDriver - The platform-specific driver implementation,
     *                         injected via the PLATFORM_DRIVER token.
     */
    constructor(
        @Inject(PLATFORM_DRIVER) private readonly platformDriver: IPlatformDriver<TPlayer>,
        @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
    ) {}

    public async invokeClient<T = any>(player: TPlayer, method: string, ...args: unknown[]): Promise<T> {
        if (!this.platformDriver.invokeClient) {
            const err = new Error(`[RpcService] invokeClient not implemented on platformDriver.`);
            this.logger.error(err);
            throw err;
        }

        try {
            const result = await this.platformDriver.invokeClient<T>(player, method, ...args);
            return result;
        } catch (error) {
            this.logger.error(`[RpcService] Rpc error on method: ${method}, error: ${error}`);
            throw error;
        }
    }

    /**
     * Invokes a method on a webview owned by a player.
     *
     * @param player - The target player instance
     * @param webviewId - The unique identifier of the webview
     * @param method - The method name to invoke inside the webview
     * @param args - Arguments to pass to the webview handler
     * @returns A promise resolving to the webview handler result
     */
    public async invokeWebview<T = any>(player: TPlayer, webviewId: string | number, method: string, ...args: unknown[]): Promise<T> {
        const result = await this.invokeClient<T | { error?: string }>(player, WebViewEvents.INVOKE_WEBVIEW_RPC, webviewId, method, ...args);

        if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') {
            throw new Error(result.error);
        }

        return result as T;
    }
}
