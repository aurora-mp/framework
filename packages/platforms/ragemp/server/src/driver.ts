import {
    IPlatformDriver,
    RpcError,
    RpcErrorCode,
    RpcFacade,
    type RpcFacadeOptions,
    Unsubscribe,
} from '@aurora-mp/core';

export interface RageServerDriverOptions extends Pick<RpcFacadeOptions, 'timeoutMs' | 'genericErrorMessage'> {
    readonly onError?: (error: unknown, context: { rpcName: string; player?: number }) => void;
}

/**
 * Implements the IPlatformDriver interface using the RAGE Multiplayer server-side API.
 */
export class RageServerDriver implements IPlatformDriver<PlayerMp> {
    private readonly facade: RpcFacade;
    private readonly onErrorHook?: RageServerDriverOptions['onError'];

    private currentPlayer: PlayerMp | undefined;
    private disposed = false;
    private readonly listeners: Array<{ name: string; cb: (...args: unknown[]) => void }> = [];

    public constructor(options: RageServerDriverOptions = {}) {
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
        this.addListener('playerQuit', (player: unknown) => {
            const id = playerId(player);
            if (id !== undefined) this.facade.cancelPlayer(id);
        });
        return this;
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.facade.dispose();
        for (const { name, cb } of this.listeners) {
            try {
                mp.events.remove(name, cb);
            } catch {
            }
        }
        this.listeners.length = 0;
    }

    public getInvocationSource(): number | undefined {
        return this.currentPlayer?.id;
    }

    public resolveNativePlayer(source: number): PlayerMp | undefined {
        return mp.players.at(source) ?? undefined;
    }

    public onPlayerJoin(listener: (source: number) => void): Unsubscribe {
        return this.addListener('playerJoin', (player: unknown) => {
            const id = playerId(player);
            if (id !== undefined) listener(id);
        });
    }

    public onPlayerDrop(listener: (source: number, reason?: string) => void): Unsubscribe {
        return this.addListener('playerQuit', (player: unknown, exitType: unknown, reason: unknown) => {
            const id = playerId(player);
            if (id === undefined) return;
            const detail = typeof reason === 'string' ? reason : typeof exitType === 'string' ? exitType : undefined;
            listener(id, detail);
        });
    }

    public on(eventName: string, listener: (...args: unknown[]) => void): Unsubscribe {
        return this.addListener(eventName, listener);
    }

    public off(eventName: string, listener: (...args: unknown[]) => void): void {
        mp.events.remove(eventName, listener);
    }

    public onClient(eventName: string, listener: (player: PlayerMp, ...args: unknown[]) => void): Unsubscribe {
        return this.addListener(eventName, (player: unknown, ...args: unknown[]) => {
            if (!isPlayer(player)) return;
            const previous = this.currentPlayer;
            this.currentPlayer = player;
            try {
                listener(player, ...args);
            } finally {
                this.currentPlayer = previous;
            }
        });
    }

    public emit(eventName: string, ...args: unknown[]): void {
        mp.events.call(eventName, ...args);
    }

    public emitClient(player: PlayerMp, eventName: string, ...args: unknown[]): void {
        player.call(eventName, args);
    }

    public invokeClient<T = unknown>(player: PlayerMp, rpcName: string, ...args: unknown[]): Promise<T> {
        const id = playerId(player);
        if (id === undefined) {
            return Promise.reject(new RpcError(`Invalid player target for RPC '${rpcName}'`, RpcErrorCode.BAD_TARGET));
        }

        return this.facade.invoke<T>({
            rpcName,
            player: id,
            send: (signal) =>
                new Promise<T>((resolve, reject) => {
                    let settled = false;
                    const onAbort = () => {
                        if (settled) return;
                        settled = true;
                        reject(signal.reason);
                    };
                    signal.addEventListener('abort', onAbort, { once: true });

                    void player.callProc(rpcName, args as unknown[]).then(
                        (value: unknown) => {
                            if (settled) return;
                            settled = true;
                            signal.removeEventListener('abort', onAbort);
                            resolve(value as T);
                        },
                        (error: unknown) => {
                            if (settled) return;
                            settled = true;
                            signal.removeEventListener('abort', onAbort);
                            reject(error);
                        },
                    );
                }),
        });
    }

    public onRpcServer(
        rpcName: string,
        handler: (...args: unknown[]) => Promise<unknown> | unknown,
    ): Unsubscribe {
        const wrapped = this.facade.wrapHandler(rpcName, handler);
        const proc = async (player: unknown, ...allArgs: unknown[]) => {
            const previous = this.currentPlayer;
            if (isPlayer(player)) this.currentPlayer = player;
            try {
                const { result, error } = await wrapped(...allArgs);
                if (error != null) throw new RpcError(error, RpcErrorCode.CLIENT_ERROR);
                return result ?? null;
            } finally {
                this.currentPlayer = previous;
            }
        };
        mp.events.addProc(rpcName, proc);
        const unsub: Unsubscribe = () => {
            try {
                mp.events.addProc(rpcName, async () => null);
            } catch {
            }
        };
        return unsub;
    }

    private addListener(eventName: string, cb: (...args: unknown[]) => void): Unsubscribe {
        mp.events.add(eventName, cb);
        const entry = { name: eventName, cb };
        this.listeners.push(entry);
        return () => {
            try {
                mp.events.remove(eventName, cb);
            } catch {
            }
            const idx = this.listeners.indexOf(entry);
            if (idx >= 0) this.listeners.splice(idx, 1);
        };
    }
}

function isPlayer(value: unknown): value is PlayerMp {
    return typeof value === 'object' && value !== null && 'id' in value && typeof (value as PlayerMp).id === 'number';
}

function playerId(value: unknown): number | undefined {
    return isPlayer(value) ? value.id : undefined;
}
