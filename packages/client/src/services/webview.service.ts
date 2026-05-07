import {
    Injectable,
    Inject,
    type IPlatformDriver,
    PLATFORM_DRIVER,
    type IWebView,
    type ILogger,
    LOGGER_SERVICE,
} from '@aurora-mp/core';

@Injectable()
export class WebviewService {
    private readonly instances = new Map<string | number, IWebView>();
    private readonly createListeners: ((id: string | number, webview: IWebView) => void)[] = [];

    constructor(
        @Inject(PLATFORM_DRIVER) private readonly platformDriver: IPlatformDriver,
        @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
    ) {}

    public create(id: string | number, url: string, focused: boolean = false, hidden: boolean = false): IWebView {
        if (!this.platformDriver.createWebview) {
            throw new Error('[Aurora] The current platform driver does not support creating webviews.');
        }

        if (this.instances.has(id)) {
            this.logger.warn(`[Aurora] A webview with ID "${id}" already exists. It will be overwritten.`);
            this.destroy(id);
        }

        const webview = this.platformDriver.createWebview(id, url, focused, hidden);
        this.instances.set(id, webview);
        this.createListeners.forEach((listener) => listener(id, webview));
        return webview;
    }

    public destroy(id: string | number): void {
        if (!this.platformDriver.destroyWebview) {
            this.logger.warn('[Aurora] The current platform driver does not support destroying webviews.');
            return;
        }

        const webview = this.instances.get(id);
        if (webview) {
            this.platformDriver.destroyWebview(id);
            this.instances.delete(id);
        }
    }

    public async invokeWebview<T = any>(id: string | number, eventName: string, ...args: unknown[]): Promise<T> {
        const webview = this.instances.get(id);

        if (!webview) {
            const error = new Error(`[Aurora] Cannot invoke webview "${id}" because it does not exist.`);
            this.logger.warn(error.message);
            throw error;
        }

        return webview.invoke<T>(eventName, ...args);
    }

    public getById(id: string | number): IWebView | undefined {
        return this.instances.get(id);
    }

    public getAll(): IWebView[] {
        return Array.from(this.instances.values());
    }

    public onCreate(listener: (id: string | number, webview: IWebView) => void) {
        this.createListeners.push(listener);
    }
}
