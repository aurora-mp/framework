import { IPlatformDriver, IWebView, WebViewEvents } from '@aurora-mp/core';

class RageWebViewWrapper implements IWebView {
    constructor(
        public readonly id: string | number,
        private webview: BrowserMp,
    ) {}

    public emit(event: string, ...args: unknown[]): void {
        this.webview.call(event, ...args);
    }

    public focus() {}

    public destroy(): void {
        this.webview.destroy();
    }
}

/**
 * Implements the IPlatformDriver interface using the RAGE Multiplayer client-side API.
 */
export class RageClientDriver implements IPlatformDriver {
    private webviews = new Map<string | number, RageWebViewWrapper>();

    constructor() {
        // Received event from (cef -> client -> server)
        mp.events.add(WebViewEvents.EMIT_SERVER, (eventName: string, ...args: unknown[]) => {
            mp.events.callRemote(eventName, ...args);
        });

        // Send event from server (server -> client -> cef)
        mp.events.add(WebViewEvents.DISPATCH, (...args: unknown[]) => {
            const [id, eventName, ...rest] = args as [string | number, string, ...unknown[]];
            const webview = this.webviews.get(id);
            if (!webview) return;

            webview.emit(eventName, ...rest);
        });

        mp.events.addProc(WebViewEvents.INVOKE_SERVER_RPC, async (rpcName: string, ...args: unknown[]) => {
            return await mp.events.callRemoteProc(rpcName, ...args);
        });
    }

    public createWebview(
        id: string | number,
        url: string,
        focused: boolean = false,
        _hidden: boolean = false,
    ): IWebView {
        const webview = mp.browsers.new(url);
        const handle = new RageWebViewWrapper(id, webview);

        this.webviews.set(id, handle);

        mp.events.add('browserDomReady', () => {
            if (focused) {
                mp.gui.cursor.visible = true;
                mp.gui.cursor.show(true, true);
            }
        });

        // TODO
        /*if (hidden) {
            webview.active = !hidden;
        }*/

        return handle;
    }

    public on(eventName: string, listener: (...args: any[]) => void): void {
        mp.events.add(eventName, listener);
    }

    public off(eventName: string, listener: (...args: any[]) => void): void {
        mp.events.remove(eventName, listener);
    }

    public onServer(eventName: string, listener: (...args: any[]) => void): void {
        mp.events.add(eventName, listener);
    }

    public emit(eventName: string, ...args: any[]): void {
        mp.events.call(eventName, ...args);
    }

    // TODO: Check if we can pass an object as an argument (to make { hello: 'world' } (typescript type))
    public emitServer(eventName: string, ...args: any[]): void {
        mp.events.callRemote(eventName, ...args);
    }

    public async invokeServer<T = any, TArgs extends any[] = any[]>(rpcName: string, ...args: TArgs): Promise<T> {
        try {
            const result = (await mp.events.callRemoteProc(rpcName, ...args)) as T;
            return result;
        } catch (error) {
            console.error(`[RPC] invokeClient failed for "${rpcName}":`, error);
            throw error;
        }
    }

    public onRpcClient(
        rpcName: string,
        handler: (player: PlayerMp, ...args: unknown[]) => Promise<unknown> | unknown,
    ): void {
        mp.events.addProc(rpcName, async (player: PlayerMp, ...allArgs: unknown[]) => {
            try {
                return await handler(player, ...allArgs);
            } catch (err) {
                return { error: (err as Error).message };
            }
        });
    }
}
