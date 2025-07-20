import { WebViewEvents } from '@aurora-mp/core';
import { IWebViewPlatform } from '../interfaces';

export class WebviewService {
    private platform: IWebViewPlatform | null;

    constructor() {
        this.platform = this.getPlatform();
    }

    public on(eventName: string, listener: (...args: any[]) => void): void {
        if (!this.platform) {
            console.warn('[Aurora] The current platform driver does not support on.');
            return;
        }

        this.platform.on(eventName, listener);
    }

    public off(eventName: string, listener: (...args: any[]) => void): void {
        if (!this.platform) {
            console.warn('[Aurora] The current platform driver does not support off.');
            return;
        }

        this.platform.off(eventName, listener);
    }

    public onServer(eventName: string, listener: (...args: any[]) => void) {
        if (!this.platform) {
            console.warn('[Aurora] The current platform driver does not support onServer.');
            return;
        }

        this.platform.on(eventName, listener);
    }

    public emit(eventName: string, ...args: any[]): void {
        if (!this.platform) {
            console.warn('[Aurora] The current platform driver does not support emit.');
            return;
        }

        this.platform.emit(eventName, ...args);
    }

    public emitServer(eventName: string, ...args: any[]) {
        if (!this.platform) {
            console.warn('[Aurora] The current platform driver does not support emitServer.');
            return;
        }

        this.platform.emitServer(WebViewEvents.EMIT_SERVER, eventName, ...args);
    }

    /**
     * Invoke a client-side RPC and await its result.
     */
    public async invokeClientRpc<T = any>(rpcName: string, ...args: any[]): Promise<T> {
        if (!this.platform) {
            console.warn('[Aurora][RPC] The current platform driver does not support invokeClientRpc.');
            return Promise.reject(new Error('invokeClientRpc not supported'));
        }

        try {
            const result = await this.platform.invokeClientRpc<T>(rpcName, ...args);
            return result;
        } catch (err) {
            console.error(`[Aurora][RPC] invokeClientRpc "${rpcName}" failed:`, err);
            throw err;
        }
    }

    public onClientRpc(rpcName: string, listener: (...args: any[]) => void) {
        if (!this.platform) {
            console.warn('[Aurora][RPC] The current platform driver does not support onClientRpc.');
            return;
        }

        this.platform.onClientRpc(rpcName, listener);
    }

    /**
     * Invoke a server-side RPC and await its result.
     */
    public async invokeServerRpc<T = any>(rpcName: string, ...args: any[]): Promise<T> {
        if (!this.platform) {
            console.warn('[Aurora][RPC] The current platform driver does not support invokeServerRpc.');
            return Promise.reject(new Error('invokeServerRpc not supported'));
        }

        try {
            const result = await this.platform.invokeServerRpc<T>(WebViewEvents.INVOKE_SERVER_RPC, rpcName, ...args);
            return result;
        } catch (err) {
            console.error(`[Aurora][RPC] invokeServerRpc "${rpcName}" failed:`, err);
            throw err;
        }
    }

    private getPlatform(): IWebViewPlatform | null {
        /*// alt:V
        if (typeof window !== 'undefined' && (window as any).alt) {
            const alt = (window as any).alt as {
                on: (event: string, listener: (...args: any[]) => void) => void;
								off: (event: string, listener: (...args: any[]) => void) => void;
                emit: (event: string, ...args: any[]) => void;
                emitServer: (event: string, ...args: any[]) => void;
            };

            return {
                on: (event, listener) => alt.on(event, listener),
								off: (event, listener) => alt.off(event, listener),
                onServer: (event, listener) => alt.on(event, listener),
                emit: (event, ...args) => alt.emit(event, ...args),
                emitServer: (event, ...args) => alt.emit(event, ...args),
            };
        }*/

        if (typeof window !== 'undefined' && (window as any).mp) {
            const mp = (window as any).mp;

            return {
                // subscribe to a normal client event
                on: (event: string, listener: (...args: any[]) => void) => mp.events.add(event, listener),
                off: (event: string, listener: (...args: any[]) => void) => mp.events.remove(event, listener),

                // alias for on(), same on the client
                onServer: (event: string, listener: (...args: any[]) => void) => mp.events.add(event, listener),

                // emit a normal client event
                emit: (event: string, ...args: any[]) => mp.events.call(event, ...args),

                // alias for emit(), same on the client
                emitServer: (event: string, ...args: any[]) => mp.events.call(event, ...args),

                /**
                 * Sends an RPC to the client and returns a Promise
                 * Invoke a client-side RPC; returns a Promise of the response
                 */
                invokeClientRpc: <T = any>(rpcName: string, ...args: any[]): Promise<T> =>
                    mp.events.callProc(rpcName, ...args),

                /**
                 * onClientRpc is **not** for invoking, but for registering
                 * a handler when the server calls a client RPC via callProc.
                 * You need to use addProc on the client to receive those.
                 */
                onClientRpc: <TArgs extends any[] = any[], TResult = any>(
                    rpcName: string,
                    handler: (...args: TArgs) => Promise<TResult> | TResult,
                ): void =>
                    mp.events.addProc(rpcName, async (...args: TArgs) => {
                        try {
                            return await handler(...args);
                        } catch (err: any) {
                            return { error: err.message ?? String(err) };
                        }
                    }),

                /**
                 * Sends an RPC to the server and returns a Promise
                 * Invoke a server-side RPC; returns a Promise of the response
                 */
                invokeServerRpc: <T = any>(rpcName: string, ...args: any[]): Promise<T> =>
                    mp.events.callProc(rpcName, ...args),
            };
        }

        return null;
    }
}
