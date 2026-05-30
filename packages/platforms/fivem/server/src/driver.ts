import { IPlatformDriver } from '@aurora-mp/core';
import {
    RPC_INVOKE_EVENT_PREFIX,
    RPC_INVOKE_RESPONSE_EVENT,
    RPC_REQUEST_EVENT_PREFIX,
    RPC_RESPONSE_EVENT,
} from './constants/rpc-events';

type RpcResolver = { resolve: (value: unknown) => void; reject: (reason: unknown) => void };

/**
 * Implements the IPlatformDriver interface using the FiveM server-side API.
 */
export class FiveMServerDriver implements IPlatformDriver {
    private readonly pendingRpcs = new Map<string, RpcResolver>();
    private rpcCounter = 0;

    constructor() {
        // Manager for server -> client RPC responses
        onNet(RPC_INVOKE_RESPONSE_EVENT, (reqId: string, result: unknown, error: string | null) => {
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

    public onClient(eventName: string, listener: (player: number, ...args: unknown[]) => void): void {
        onNet(eventName, (...args: unknown[]) => {
            listener(source, ...args);
        });
    }

    public emit(eventName: string, ...args: unknown[]): void {
        emit(eventName, ...args);
    }

    public emitClient(player: number, eventName: string, ...args: unknown[]): void {
        emitNet(eventName, player, ...args);
    }

    public invokeClient<T = any>(player: number, rpcName: string, ...args: unknown[]): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const reqId = String(++this.rpcCounter);
            this.pendingRpcs.set(reqId, { resolve: resolve as (v: unknown) => void, reject });
            emitNet(`${RPC_INVOKE_EVENT_PREFIX}${rpcName}`, player, reqId, ...args);
        });
    }

    public onRpcServer(rpcName: string, handler: (...args: unknown[]) => Promise<unknown> | unknown): void {
        onNet(`${RPC_REQUEST_EVENT_PREFIX}${rpcName}`, async (reqId: string, ...args: unknown[]) => {
            const player = source;
            try {
                const result = await handler(...args);
                emitNet(RPC_RESPONSE_EVENT, player, reqId, result, null);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                emitNet(RPC_RESPONSE_EVENT, player, reqId, null, message);
            }
        });
    }
}
