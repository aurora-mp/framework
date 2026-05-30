import { IPlatformDriver, IWebView } from '@aurora-mp/core';
import {
    RPC_INVOKE_EVENT_PREFIX,
    RPC_INVOKE_RESPONSE_EVENT,
    RPC_REQUEST_EVENT_PREFIX,
    RPC_RESPONSE_EVENT,
} from './constants/rpc-events';

type RpcResolver = { resolve: (value: unknown) => void; reject: (reason: unknown) => void };

class FiveMNUIWebView implements IWebView {
    private readonly pending = new Map<string, RpcResolver>();
    private counter = 0;

    constructor(private readonly id: string | number) {
        RegisterNuiCallback(
            `aurora:invoke:${id}:response`,
            (data: { reqId: string; result?: unknown; error?: string }, cb: (r: object) => void) => {
                const resolver = this.pending.get(data.reqId);
                if (resolver) {
                    this.pending.delete(data.reqId);
                    if (data.error) resolver.reject(new Error(data.error));
                    else resolver.resolve(data.result);
                }
                cb({});
            },
        );
    }

    public emit(event: string, ...args: unknown[]): void {
        SendNUIMessage({ type: 'aurora:emit', id: this.id, event, args });
    }

    public invoke<T = unknown>(event: string, ...args: unknown[]): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const reqId = `${this.id}:${++this.counter}`;
            this.pending.set(reqId, { resolve: resolve as (v: unknown) => void, reject });
            SendNUIMessage({ type: 'aurora:invoke', id: this.id, reqId, event, args });
        });
    }

    public destroy(): void {
        SetNuiFocus(false, false);
        this.pending.clear();
    }
}

export class FiveMClientDriver implements IPlatformDriver {
    private readonly pendingRpcs = new Map<string, RpcResolver>();
    private readonly webviews = new Map<string | number, FiveMNUIWebView>();
    private rpcCounter = 0;

    constructor() {
        // Single listener that routes all server→client RPC responses back to pending invokeServer calls
        onNet(RPC_RESPONSE_EVENT, (reqId: string, result: unknown, error: string | null) => {
            const resolver = this.pendingRpcs.get(reqId);
            if (!resolver) return;
            this.pendingRpcs.delete(reqId);
            if (error) resolver.reject(new Error(error));
            else resolver.resolve(result);
        });
    }

    public on(eventName: string, listener: (...args: unknown[]) => void): void {
        on(eventName, listener);
    }

    public off(eventName: string, listener: (...args: unknown[]) => void): void {
        removeEventListener(eventName, listener);
    }

    public onServer(eventName: string, listener: (player: number, ...args: unknown[]) => void): void {
        onNet(eventName, (...args: unknown[]) => (listener as (...a: unknown[]) => void)(...args));
    }

    public emit(eventName: string, ...args: unknown[]): void {
        emit(eventName, ...args);
    }

    public emitServer(eventName: string, ...args: unknown[]): void {
        emitNet(eventName, ...args);
    }

    public invokeServer<T = any>(rpcName: string, ...args: unknown[]): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const reqId = String(++this.rpcCounter);
            this.pendingRpcs.set(reqId, { resolve: resolve as (v: unknown) => void, reject });
            emitNet(`${RPC_REQUEST_EVENT_PREFIX}${rpcName}`, reqId, ...args);
        });
    }

    public onRpcClient(rpcName: string, handler: (...args: unknown[]) => Promise<unknown> | unknown): void {
        // Listens for server-initiated RPC calls and responds with the handler result
        onNet(`${RPC_INVOKE_EVENT_PREFIX}${rpcName}`, async (reqId: string, ...args: unknown[]) => {
            try {
                const result = await handler(...args);
                emitNet(RPC_INVOKE_RESPONSE_EVENT, reqId, result, null);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                emitNet(RPC_INVOKE_RESPONSE_EVENT, reqId, null, message);
            }
        });
    }

    public createWebview(id: string | number, _url: string, focused: boolean, hidden: boolean): IWebView {
        if (this.webviews.has(id)) {
            this.webviews.get(id)!.destroy();
        }
        if (!hidden) {
            SetNuiFocus(focused, focused);
        }
        const webview = new FiveMNUIWebView(id);
        this.webviews.set(id, webview);
        return webview;
    }

    public destroyWebview(id: string | number): void {
        const webview = this.webviews.get(id);
        if (webview) {
            webview.destroy();
            this.webviews.delete(id);
        }
    }
}
