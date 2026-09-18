import { IPlatformDriver, IWebView, RpcError, Unsubscribe, WebViewEvents } from '@aurora-mp/core';
import {
    RPC_INVOKE_EVENT_PREFIX,
    RPC_INVOKE_RESPONSE_EVENT,
    RPC_REQUEST_EVENT_PREFIX,
    RPC_RESPONSE_EVENT,
} from './constants/rpc-events';

export interface FiveMClientDriverOptions {
    /** Timeout for client→server RPCs. Default 10s. */
    readonly rpcTimeoutMs?: number;
    /** Timeout for client→webview (NUI) RPCs. Default 5s. */
    readonly webviewRpcTimeoutMs?: number;
    /** Message forwarded to callers when a handler throws a non-`RpcError`. */
    readonly genericErrorMessage?: string;
    /** Observability hook — invoked with any internal error the driver swallows. */
    readonly onError?: (error: unknown, context: { rpcName: string }) => void;
}

interface PendingRpc {
    readonly resolve: (value: unknown) => void;
    readonly reject: (reason: unknown) => void;
}

const DEFAULT_RPC_TIMEOUT_MS = 10_000;
const DEFAULT_WEBVIEW_RPC_TIMEOUT_MS = 5_000;
const DEFAULT_GENERIC_ERROR = 'Internal client error';

class FiveMNUIWebView implements IWebView {
    private readonly pending = new Map<string, PendingRpc>();
    private counter = 0;
    private disposed = false;

    constructor(
        private readonly id: string | number,
        private readonly timeoutMs: number,
        private readonly onError: FiveMClientDriverOptions['onError'],
    ) {
        RegisterNuiCallback(
            `aurora:invoke:${id}:response`,
            (data: { reqId: string; result?: unknown; error?: string }, cb: (r: object) => void) => {
                const resolver = this.pending.get(data.reqId);
                if (resolver) {
                    this.pending.delete(data.reqId);
                    if (data.error) {
                        resolver.reject(new RpcError(data.error, 'RPC_WEBVIEW_ERROR'));
                    } else {
                        resolver.resolve(data.result);
                    }
                }
                cb({});
            },
        );
    }

    public emit(event: string, ...args: unknown[]): void {
        if (this.disposed) return;
        // SendNUIMessage(obj) mangles non-ASCII text (accents, etc); stringify manually instead.
        SendNuiMessage(JSON.stringify({ type: 'aurora:emit', id: this.id, event, args }));
    }

    public invoke<T = unknown>(event: string, ...args: unknown[]): Promise<T> {
        if (this.disposed) {
            return Promise.reject(new RpcError('WebView disposed', 'RPC_DISPOSED'));
        }
        return new Promise<T>((resolve, reject) => {
            const reqId = `${this.id}:${++this.counter}`;
            const timer = setTimeout(() => {
                if (!this.pending.has(reqId)) return;
                this.pending.delete(reqId);
                reject(new RpcError(`WebView RPC '${event}' timed out`, 'RPC_TIMEOUT'));
            }, this.timeoutMs);
            timer.unref?.();

            this.pending.set(reqId, {
                resolve: (value) => {
                    clearTimeout(timer);
                    resolve(value as T);
                },
                reject: (reason) => {
                    clearTimeout(timer);
                    reject(reason);
                },
            });

            try {
                SendNuiMessage(JSON.stringify({ type: 'aurora:invoke', id: this.id, reqId, event, args }));
            } catch (err) {
                this.pending.delete(reqId);
                clearTimeout(timer);
                this.onError?.(err, { rpcName: event });
                reject(new RpcError(`Failed to dispatch WebView RPC '${event}'`, 'RPC_DISPATCH_FAILED'));
            }
        });
    }

    public destroy(): void {
        if (this.disposed) return;
        this.disposed = true;
        SetNuiFocus(false, false);
        for (const [, pending] of this.pending) {
            pending.reject(new RpcError('WebView destroyed', 'RPC_DISPOSED'));
        }
        this.pending.clear();
    }
}

/** FiveM client-side platform driver. */
export class FiveMClientDriver implements IPlatformDriver {
    private readonly pendingRpcs = new Map<string, PendingRpc>();
    private readonly webviews = new Map<string | number, FiveMNUIWebView>();
    private readonly disposers = new Set<Unsubscribe>();

    private readonly rpcTimeoutMs: number;
    private readonly webviewRpcTimeoutMs: number;
    private readonly genericErrorMessage: string;
    private readonly onError?: FiveMClientDriverOptions['onError'];

    private rpcCounter = 0;
    private initialized = false;
    private disposed = false;

    public constructor(options: FiveMClientDriverOptions = {}) {
        this.rpcTimeoutMs = options.rpcTimeoutMs ?? DEFAULT_RPC_TIMEOUT_MS;
        this.webviewRpcTimeoutMs = options.webviewRpcTimeoutMs ?? DEFAULT_WEBVIEW_RPC_TIMEOUT_MS;
        this.genericErrorMessage = options.genericErrorMessage ?? DEFAULT_GENERIC_ERROR;
        this.onError = options.onError;
    }

    public init(): this {
        if (this.initialized) {
            throw new Error('FiveMClientDriver.init() called more than once.');
        }
        this.initialized = true;

        this.addNetListener(RPC_RESPONSE_EVENT, (reqId: unknown, result: unknown, error: unknown) => {
            if (typeof reqId !== 'string') return;
            const pending = this.pendingRpcs.get(reqId);
            if (!pending) return;
            this.pendingRpcs.delete(reqId);

            if (error != null) {
                const message = typeof error === 'string' ? error : 'Server RPC handler failed';
                pending.reject(new RpcError(message, 'RPC_SERVER_ERROR'));
            } else {
                pending.resolve(result);
            }
        });

        // Server -> client -> CEF: route dispatched webview events to the target NUI
        this.addNetListener(WebViewEvents.DISPATCH, (...args: unknown[]) => {
            const [id, eventName, ...rest] = args as [string | number, string, ...unknown[]];
            if (typeof eventName !== 'string') return;
            const webview = this.webviews.get(id);
            if (!webview) return;
            webview.emit(eventName, ...rest);
        });

        return this;
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;

        for (const dispose of [...this.disposers]) dispose();
        this.disposers.clear();

        for (const [id, view] of this.webviews) {
            this.webviews.delete(id);
            view.destroy();
        }

        for (const [key, pending] of this.pendingRpcs) {
            this.pendingRpcs.delete(key);
            pending.reject(new RpcError('Driver disposed', 'RPC_DISPOSED'));
        }
    }

    public on(eventName: string, listener: (...args: unknown[]) => void): Unsubscribe {
        return this.addListener(eventName, listener);
    }

    public off(eventName: string, listener: (...args: unknown[]) => void): void {
        removeEventListener(eventName, listener);
    }

    public onServer(eventName: string, listener: (...args: unknown[]) => void): Unsubscribe {
        return this.addNetListener(eventName, (...args: unknown[]) => listener(...args));
    }

    public emit(eventName: string, ...args: unknown[]): void {
        emit(eventName, ...args);
    }

    public emitServer(eventName: string, ...args: unknown[]): void {
        this.safeEmitNet(eventName, ...args);
    }

    public invokeServer<T = unknown>(rpcName: string, ...args: unknown[]): Promise<T> {
        if (this.disposed) {
            return Promise.reject(new RpcError('Driver disposed', 'RPC_DISPOSED'));
        }

        const reqId = String(++this.rpcCounter);

        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRpcs.delete(reqId);
                reject(new RpcError(`RPC '${rpcName}' to server timed out`, 'RPC_TIMEOUT'));
            }, this.rpcTimeoutMs);
            timer.unref?.();

            this.pendingRpcs.set(reqId, {
                resolve: (value) => {
                    clearTimeout(timer);
                    resolve(value as T);
                },
                reject: (reason) => {
                    clearTimeout(timer);
                    reject(reason);
                },
            });

            const sent = this.safeEmitNet(`${RPC_REQUEST_EVENT_PREFIX}${rpcName}`, reqId, ...args);
            if (!sent) {
                this.pendingRpcs.delete(reqId);
                clearTimeout(timer);
                reject(new RpcError(`Failed to dispatch RPC '${rpcName}'`, 'RPC_DISPATCH_FAILED'));
            }
        });
    }

    public onRpcClient(
        rpcName: string,
        handler: (...args: unknown[]) => Promise<unknown> | unknown,
    ): Unsubscribe {
        return this.addNetListener(`${RPC_INVOKE_EVENT_PREFIX}${rpcName}`, (reqId: unknown, ...args: unknown[]) => {
            if (typeof reqId !== 'string') return;
            void this.runRpcHandler(rpcName, reqId, handler, args);
        });
    }
    
    public createNuiDriver(id: string | number, focused: boolean, hasCursor: boolean): IWebView {
        const existing = this.webviews.get(id);
        if (existing) existing.destroy();

        SetNuiFocus(focused, hasCursor);

        const webview = new FiveMNUIWebView(id, this.webviewRpcTimeoutMs, this.onError);
        this.webviews.set(id, webview);

        this.registerNuiBridges();

        return webview;
    }

    /**
     * Registers the fetch endpoints the CEF adapter uses to reach the server:
     * - `EMIT_SERVER` -> `emitNet(eventName, ...args)`
     * - `INVOKE_SERVER_RPC` -> `invokeServer(rpcName, ...args)` and returns the result
     */
    private registerNuiBridges(): void {
        this.onNuiCallback(WebViewEvents.EMIT_SERVER, (payload) => {
            const data = payload as { eventName?: unknown; args?: unknown };
            if (typeof data.eventName !== 'string') return;
            const args = Array.isArray(data.args) ? data.args : [];
            this.safeEmitNet(data.eventName, ...args);
        });

        this.onNuiCallback(WebViewEvents.INVOKE_SERVER_RPC, async (payload) => {
            const data = payload as { rpcName?: unknown; args?: unknown };
            if (typeof data.rpcName !== 'string') {
                throw new RpcError('invokeServerRpc bridge missing rpcName', 'RPC_BAD_REQUEST');
            }
            const args = Array.isArray(data.args) ? data.args : [];
            return this.invokeServer(data.rpcName, ...args);
        });
    }

    public onNuiCallback(
        name: string,
        handler: (payload: unknown) => Promise<unknown> | unknown,
    ): void {
        RegisterNuiCallback(name, async (data: unknown, cb: (response: unknown) => void) => {
            try {
                const result = await handler(data);
                cb(result ?? {});
            } catch (error) {
                this.onError?.(error, { rpcName: name });
                const message = error instanceof RpcError ? error.message : this.genericErrorMessage;
                cb({ error: message });
            }
        });
    }

    /**
    * `async` keeps a sync throw from turning into a hung RPC.
     */
    private async runRpcHandler(
        rpcName: string,
        reqId: string,
        handler: (...args: unknown[]) => Promise<unknown> | unknown,
        args: unknown[],
    ): Promise<void> {
        try {
            const result = await handler(...args);
            this.safeEmitNet(RPC_INVOKE_RESPONSE_EVENT, reqId, result, null);
        } catch (error: unknown) {
            this.onError?.(error, { rpcName });

            const message = error instanceof RpcError ? error.message : this.genericErrorMessage;
            this.safeEmitNet(RPC_INVOKE_RESPONSE_EVENT, reqId, null, message);
        }
    }

    private safeEmitNet(eventName: string, ...args: unknown[]): boolean {
        try {
            emitNet(eventName, ...args);
            return true;
        } catch (error: unknown) {
            this.onError?.(error, { rpcName: eventName });
            return false;
        }
    }

    private addListener(eventName: string, wrapped: (...args: unknown[]) => void): Unsubscribe {
        return this.track(eventName, wrapped, on);
    }

    private addNetListener(eventName: string, wrapped: (...args: unknown[]) => void): Unsubscribe {
        return this.track(eventName, wrapped, onNet);
    }

    private track(
        eventName: string,
        wrapped: (...args: unknown[]) => void,
        register: (name: string, cb: (...args: unknown[]) => void) => void,
    ): Unsubscribe {
        let active = true;

        const guarded = (...args: unknown[]): void => {
            if (active) wrapped(...args);
        };

        register(eventName, guarded);

        const unsubscribe: Unsubscribe = () => {
            if (!active) return;
            active = false;
            this.disposers.delete(unsubscribe);

            try {
                removeEventListener(eventName, guarded);
            } catch {
            }
        };

        this.disposers.add(unsubscribe);
        return unsubscribe;
    }
}
