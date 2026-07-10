import { AsyncLocalStorage } from 'node:async_hooks';
import {
    IPlatformDriver,
    RpcError,
    RpcErrorCode,
    RpcFacade,
    type RpcFacadeOptions,
    Unsubscribe,
} from '@aurora-mp/core';
import {
    RPC_INVOKE_EVENT_PREFIX,
    RPC_INVOKE_RESPONSE_EVENT,
    RPC_REQUEST_EVENT_PREFIX,
    RPC_RESPONSE_EVENT,
} from './constants/rpc-events';

export interface FiveMServerDriverOptions extends Pick<RpcFacadeOptions, 'timeoutMs' | 'genericErrorMessage'> {
    readonly onError?: (error: unknown, context: { rpcName: string; player?: number }) => void;
}

function normalizePlayer(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

/** FiveM server-side platform driver. */
export class FiveMServerDriver implements IPlatformDriver<number> {
    private readonly facade: RpcFacade;
    private readonly disposers = new Set<Unsubscribe>();

    private readonly pendingRequests = new Map<
        string,
        { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
    >();

    private readonly sourceStore = new AsyncLocalStorage<number | undefined>();

    private readonly onErrorHook?: FiveMServerDriverOptions['onError'];

    private rpcCounter = 0;
    private initialized = false;
    private disposed = false;

    public constructor(options: FiveMServerDriverOptions = {}) {
        this.onErrorHook = options.onError;
        const facadeOptions: RpcFacadeOptions = {
            onError: (error, context) => this.onErrorHook?.(error, context),
            ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
            ...(options.genericErrorMessage !== undefined
                ? { genericErrorMessage: options.genericErrorMessage }
                : {}),
        };
        this.facade = new RpcFacade(facadeOptions);
    }

    public init(): this {
        if (this.initialized) {
            throw new Error('FiveMServerDriver.init() called more than once.');
        }
        this.initialized = true;

        this.addNetListener(RPC_INVOKE_RESPONSE_EVENT, (reqId: unknown, result: unknown, error: unknown) => {
            const player = normalizePlayer(source);
            if (player === undefined || typeof reqId !== 'string') return;

            const pending = this.pendingRequests.get(`${player}:${reqId}`);
            if (!pending) return;
            this.pendingRequests.delete(`${player}:${reqId}`);

            if (error != null) {
                const message = typeof error === 'string' ? error : 'Client RPC handler failed';
                pending.reject(new RpcError(message, RpcErrorCode.CLIENT_ERROR));
            } else {
                pending.resolve(result);
            }
        });

        this.addListener('playerDropped', () => {
            const player = normalizePlayer(source);
            if (player !== undefined) this.facade.cancelPlayer(player);
        });

        return this;
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;

        for (const dispose of [...this.disposers]) dispose();
        this.disposers.clear();

        this.facade.dispose();

        for (const [key, pending] of this.pendingRequests) {
            this.pendingRequests.delete(key);
            pending.reject(new RpcError('Driver disposed', RpcErrorCode.DISPOSED));
        }
    }

    public getInvocationSource(): number | undefined {
        return this.sourceStore.getStore();
    }

    public resolveNativePlayer(source: number): number | undefined {
        return normalizePlayer(source);
    }

    public getPlayerName(source: number): string | undefined {
        const player = normalizePlayer(source);
        if (player === undefined) return undefined;
        try {
            return GetPlayerName(String(player));
        } catch {
            return undefined;
        }
    }

    public getPlayerPosition(source: number): { x: number; y: number; z: number } | undefined {
        const ped = this.getPlayerPed(source);
        if (ped === undefined || ped === 0) return undefined;
        try {
            const coords = GetEntityCoords(ped);
            return { x: coords[0] ?? 0, y: coords[1] ?? 0, z: coords[2] ?? 0 };
        } catch {
            return undefined;
        }
    }

    public getPlayerHeading(source: number): number | undefined {
        const ped = this.getPlayerPed(source);
        if (ped === undefined || ped === 0) return undefined;
        try {
            return GetEntityHeading(ped);
        } catch {
            return undefined;
        }
    }

    public getPlayerDimension(source: number): number | undefined {
        const player = normalizePlayer(source);
        if (player === undefined) return undefined;
        try {
            return GetPlayerRoutingBucket(String(player));
        } catch {
            return undefined;
        }
    }

    public setPlayerDimension(source: number, dimension: number): void {
        const player = normalizePlayer(source);
        if (player === undefined) return;
        try {
            SetPlayerRoutingBucket(String(player), dimension);
        } catch {
        }
    }

    public getPlayerVehicle(source: number): unknown {
        const ped = this.getPlayerPed(source);
        if (ped === undefined || ped === 0) return undefined;
        try {
            const vehicle = GetVehiclePedIsIn(ped, false);
            return vehicle === 0 ? undefined : vehicle;
        } catch {
            return undefined;
        }
    }

    public getPlayerModel(source: number): number | undefined {
        const ped = this.getPlayerPed(source);
        if (ped === undefined || ped === 0) return undefined;
        try {
            return GetEntityModel(ped);
        } catch {
            return undefined;
        }
    }

    public setPlayerModel(source: number, model: number): void {
        const player = normalizePlayer(source);
        if (player === undefined) return;
        try {
            SetPlayerModel(String(player), model);
        } catch {
        }
    }

    public getPlayerHealth(source: number): number | undefined {
        const ped = this.getPlayerPed(source);
        if (ped === undefined || ped === 0) return undefined;
        try {
            return GetEntityHealth(ped);
        } catch {
            return undefined;
        }
    }

    public setPlayerVariable(source: number, key: string, value: unknown): void {
        const player = normalizePlayer(source);
        if (player === undefined) return;
        try {
            const bag = (globalThis as { Player?: (id: string) => { state: { set: (k: string, v: unknown, r: boolean) => void } } }).Player;
            bag?.(String(player)).state.set(key, value, true);
        } catch {
        }
    }

    public getPlayerVariable(source: number, key: string): unknown {
        const player = normalizePlayer(source);
        if (player === undefined) return undefined;
        try {
            const bag = (globalThis as { Player?: (id: string) => { state: Record<string, unknown> } }).Player;
            return bag?.(String(player)).state[key];
        } catch {
            return undefined;
        }
    }

    private getPlayerPed(source: number): number | undefined {
        const player = normalizePlayer(source);
        if (player === undefined) return undefined;
        try {
            return GetPlayerPed(String(player));
        } catch {
            return undefined;
        }
    }

    public onPlayerJoin(listener: (source: number) => void): Unsubscribe {
        return this.addListener('playerJoining', () => {
            const player = normalizePlayer(source);
            if (player !== undefined) listener(player);
        });
    }

    public onPlayerDrop(listener: (source: number, reason?: string) => void): Unsubscribe {
        return this.addListener('playerDropped', (reason: unknown) => {
            const player = normalizePlayer(source);
            if (player !== undefined) listener(player, typeof reason === 'string' ? reason : undefined);
        });
    }

    public on(eventName: string, listener: (...args: unknown[]) => void): Unsubscribe {
        return this.addListener(eventName, (...args: unknown[]) => {
            const player = this.sourceStore.getStore() ?? normalizePlayer(source);
            this.sourceStore.run(player, () => listener(...args));
        });
    }

    public onClient(eventName: string, listener: (player: number, ...args: unknown[]) => void): Unsubscribe {
        return this.addNetListener(eventName, (...args: unknown[]) => {
            const player = normalizePlayer(source);
            if (player === undefined) return;
            this.sourceStore.run(player, () => listener(player, ...args));
        });
    }

    public emit(eventName: string, ...args: unknown[]): void {
        emit(eventName, ...args);
    }

    public emitClient(player: number, eventName: string, ...args: unknown[]): void {
        this.safeEmitNet(eventName, player, ...args);
    }

    public invokeClient<T = unknown>(player: number, rpcName: string, ...args: unknown[]): Promise<T> {
        if (normalizePlayer(player) === undefined) {
            return Promise.reject(new RpcError(`Invalid player id: ${String(player)}`, RpcErrorCode.BAD_TARGET));
        }

        return this.facade.invoke<T>({
            rpcName,
            player,
            send: (signal) =>
                new Promise<T>((resolve, reject) => {
                    const reqId = String(++this.rpcCounter);
                    const key = `${player}:${reqId}`;

                    const onAbort = () => {
                        this.pendingRequests.delete(key);
                        reject(signal.reason);
                    };

                    this.pendingRequests.set(key, {
                        resolve: (value) => {
                            signal.removeEventListener('abort', onAbort);
                            resolve(value as T);
                        },
                        reject: (reason) => {
                            signal.removeEventListener('abort', onAbort);
                            reject(reason);
                        },
                    });

                    signal.addEventListener('abort', onAbort, { once: true });

                    const sent = this.safeEmitNet(
                        `${RPC_INVOKE_EVENT_PREFIX}${rpcName}`,
                        player,
                        reqId,
                        ...args,
                    );
                    if (!sent) {
                        this.pendingRequests.delete(key);
                        signal.removeEventListener('abort', onAbort);
                        reject(new RpcError(`Failed to dispatch RPC '${rpcName}'`, RpcErrorCode.DISPATCH_FAILED));
                    }
                }),
        });
    }

    public onRpcServer(
        rpcName: string,
        handler: (...args: unknown[]) => Promise<unknown> | unknown,
    ): Unsubscribe {
        const wrapped = this.facade.wrapHandler(rpcName, handler);
        return this.addNetListener(
            `${RPC_REQUEST_EVENT_PREFIX}${rpcName}`,
            (reqId: unknown, ...args: unknown[]) => {
                const player = normalizePlayer(source);
                if (player === undefined || typeof reqId !== 'string') return;
                void this.sourceStore.run(player, async () => {
                    const { result, error } = await wrapped(...args);
                    this.safeEmitNet(RPC_RESPONSE_EVENT, player, reqId, result ?? null, error ?? null);
                });
            },
        );
    }

    private safeEmitNet(eventName: string, player: number, ...args: unknown[]): boolean {
        try {
            emitNet(eventName, player, ...args);
            return true;
        } catch (error: unknown) {
            this.onErrorHook?.(error, { rpcName: eventName, player });
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
