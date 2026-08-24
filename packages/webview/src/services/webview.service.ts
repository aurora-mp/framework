import { NUI_ID, WebViewEvents, WebviewRpcRequest, WebviewRpcResponse } from '@aurora-mp/core';
import { IWebViewPlatform } from '../interfaces';

/**
 * FiveM injects `GetParentResourceName` into every NUI page. Used as a runtime
 * probe for the FiveM CEF adapter.
 */
type FiveMWindow = Window & { GetParentResourceName?: () => string };

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

    /**
     * Register a handler that the client can invoke via WebviewService.invokeWebview().
     * The return value (or thrown error) is automatically sent back as a response.
     */
    public onRpc<TArgs extends unknown[] = any[], TResult = unknown>(
        rpcName: string,
        handler: (...args: TArgs) => Promise<TResult> | TResult,
    ): void {
        if (!this.platform) {
            console.warn('[Aurora][RPC] The current platform driver does not support onRpc.');
            return;
        }

        this.platform.onRpc(rpcName, handler);
    }

    private getPlatform(): IWebViewPlatform | null {
        if (typeof window === 'undefined') return null;

        if ((window as any).mp) {
            return this.createRageMPPlatform();
        }

        const fivem = window as FiveMWindow;
        if (typeof fivem.GetParentResourceName === 'function') {
            return this.createFiveMPlatform(fivem.GetParentResourceName());
        }

        return null;
    }

    private createRageMPPlatform(): IWebViewPlatform {
        const mp = (window as any).mp;

        const rpcHandlers = new Map<string, (...args: any[]) => Promise<unknown> | unknown>();
        let rpcListenerRegistered = false;

        return {
            on: (event: string, listener: (...args: any[]) => void) => mp.events.add(event, listener),
            off: (event: string, listener: (...args: any[]) => void) => mp.events.remove(event, listener),
            onServer: (event: string, listener: (...args: any[]) => void) => mp.events.add(event, listener),
            emit: (event: string, ...args: any[]) => mp.events.call(event, ...args),
            emitServer: (event: string, ...args: any[]) => mp.events.call(event, ...args),

            invokeClientRpc: <T = any>(rpcName: string, ...args: any[]): Promise<T> =>
                mp.events.callProc(rpcName, ...args),

            onClientRpc: <TArgs extends any[] = any[], TResult = any>(
                rpcName: string,
                handler: (...args: TArgs) => Promise<TResult> | TResult,
            ): (() => void) => {
                const wrappedHandler = async (...args: TArgs) => {
                    try {
                        return await handler(...args);
                    } catch (err: any) {
                        return { error: err.message ?? String(err) };
                    }
                };
                mp.events.addProc(rpcName, wrappedHandler);
                return () => mp.events.remove(rpcName, wrappedHandler);
            },

            invokeServerRpc: <T = any>(rpcName: string, ...args: any[]): Promise<T> =>
                mp.events.callProc(rpcName, ...args),

            onRpc: (rpcName: string, handler: (...args: any[]) => Promise<unknown> | unknown): void => {
                rpcHandlers.set(rpcName, handler);

                if (!rpcListenerRegistered) {
                    rpcListenerRegistered = true;

                    mp.events.add(WebViewEvents.INVOKE_WEBVIEW_RPC, async (rawPayload: string) => {
                        let req: WebviewRpcRequest;
                        try {
                            req = JSON.parse(rawPayload) as WebviewRpcRequest;
                        } catch {
                            console.error('[Aurora][RPC] Failed to parse INVOKE_WEBVIEW_RPC payload:', rawPayload);
                            return;
                        }

                        const fn = rpcHandlers.get(req.name);
                        const resp: WebviewRpcResponse = { id: req.id };

                        try {
                            if (fn) {
                                resp.result = await fn(...req.args);
                            } else {
                                resp.error = `No handler registered for webview RPC "${req.name}"`;
                            }
                        } catch (err: any) {
                            resp.error = err?.message ?? String(err);
                        }

                        mp.events.call(WebViewEvents.INVOKE_WEBVIEW_RPC_RESPONSE, JSON.stringify(resp));
                    });
                }
            },
        };
    }

    /**
     * FiveM has one CEF per resource. Client -> CEF goes through `SendNUIMessage`
     * (which reaches us as a `window.message` event), and CEF -> client goes through
     * a `fetch('https://cfx-nui-<res>/<name>')` that lands in a `RegisterNuiCallback`
     * on the game side.
     *
     * The client driver wraps outbound messages as `{ type, id, event, args }`; we
     * filter by `id === NUI_ID` here.
     */
    private createFiveMPlatform(resourceName: string): IWebViewPlatform {
        const eventListeners = new Map<string, Set<(...args: any[]) => void>>();
        const rpcHandlers = new Map<string, (...args: any[]) => Promise<unknown> | unknown>();
        let messageListenerAttached = false;

        const ensureMessageListener = () => {
            if (messageListenerAttached) return;
            messageListenerAttached = true;

            window.addEventListener('message', (event: MessageEvent) => {
                const data = event.data;
                if (!data || typeof data !== 'object' || data.id !== NUI_ID) return;

                if (data.type === 'aurora:emit' && typeof data.event === 'string') {
                    const set = eventListeners.get(data.event);
                    if (!set) return;
                    const args = Array.isArray(data.args) ? data.args : [];
                    for (const fn of set) {
                        try {
                            fn(...args);
                        } catch (err) {
                            console.error(`[Aurora] Listener for "${data.event}" threw:`, err);
                        }
                    }
                    return;
                }

                if (
                    data.type === 'aurora:invoke' &&
                    typeof data.event === 'string' &&
                    typeof data.reqId === 'string'
                ) {
                    const handler = rpcHandlers.get(data.event);
                    const responseUrl = `https://${resourceName}/aurora:invoke:${NUI_ID}:response`;
                    const args = Array.isArray(data.args) ? data.args : [];

                    (async () => {
                        const payload: { reqId: string; result?: unknown; error?: string } = {
                            reqId: data.reqId,
                        };
                        if (!handler) {
                            payload.error = `No handler registered for webview RPC "${data.event}"`;
                        } else {
                            try {
                                payload.result = await handler(...args);
                            } catch (err: any) {
                                payload.error = err?.message ?? String(err);
                            }
                        }

                        void fetch(responseUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                        }).catch((err) =>
                            console.error('[Aurora] Failed to POST NUI RPC response:', err),
                        );
                    })();
                }
            });
        };

        const post = async <T = unknown>(name: string, body: unknown): Promise<T> => {
            const res = await fetch(`https://${resourceName}/${name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`NUI callback "${name}" returned ${res.status}`);
            const text = await res.text();
            if (!text) return undefined as T;
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error) {
                throw new Error(String(parsed.error));
            }
            return parsed as T;
        };

        return {
            on(eventName, listener) {
                ensureMessageListener();
                let set = eventListeners.get(eventName);
                if (!set) {
                    set = new Set();
                    eventListeners.set(eventName, set);
                }
                set.add(listener);
            },

            off(eventName, listener) {
                eventListeners.get(eventName)?.delete(listener);
            },

            onServer(eventName, listener) {
                ensureMessageListener();
                let set = eventListeners.get(eventName);
                if (!set) {
                    set = new Set();
                    eventListeners.set(eventName, set);
                }
                set.add(listener);
            },

            emit(eventName, ...args) {
                void fetch(`https://${resourceName}/${eventName}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ args }),
                }).catch((err) =>
                    console.error(`[Aurora] Failed to emit NUI event "${eventName}":`, err),
                );
            },

            emitServer(_bridge, eventName, ...args) {
                void fetch(`https://${resourceName}/${WebViewEvents.EMIT_SERVER}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventName, args }),
                }).catch((err) =>
                    console.error(`[Aurora] Failed to emit server event "${eventName}":`, err),
                );
            },

            async invokeClientRpc<T = unknown>(rpcName: string, ...args: any[]): Promise<T> {
                return post<T>(rpcName, { args });
            },

            onClientRpc(rpcName, handler) {
                ensureMessageListener();
                rpcHandlers.set(rpcName, handler as any);
                return () => rpcHandlers.delete(rpcName);
            },

            async invokeServerRpc<T = unknown>(_bridge: string, rpcName?: string, ...args: any[]): Promise<T> {
                return post<T>(WebViewEvents.INVOKE_SERVER_RPC, { rpcName, args });
            },

            onRpc(rpcName, handler) {
                ensureMessageListener();
                rpcHandlers.set(rpcName, handler as any);
            },
        };
    }
}
