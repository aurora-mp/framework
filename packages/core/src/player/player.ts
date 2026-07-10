import { IPlatformDriver } from '../interfaces/platform-driver.interface';
import { RpcError } from '../errors/rpc-error';
import { RpcErrorCode } from '../rpc/rpc-codes';
import type { PlayerComponentCtor } from './player-component';

/**
 * Framework-owned representation of a connected player.
 *
 * `Player` is a *behaviour surface*, not a data bag. Domain state (accounts,
 * inventories, wallets) lives on {@link PlayerComponentCtor components}
 *
 * @typeParam TNative - The native player representation supplied by the
 * platform driver (e.g. `number` on FiveM, `PlayerMp` on RAGE-MP).
 *
 * @public
 */
export class PlayerEntity<TNative = unknown> {
    /** Untyped bag used by {@link PlayerExtender extenders} for ad-hoc augmentation. */
    public readonly ext: Record<string, unknown> = {};

    /**
     * @param source Normalised numeric player id from the platform driver.
     * @param native Platform-native handle (e.g. `PlayerMp` on RAGE-MP).
     * @param driver The platform driver used to route emit / invoke / kick.
     * @param components Storage for attached components; owned by the
     *   {@link PlayerRegistry} that constructed this wrapper.
     * @internal
     */
    public constructor(
        public readonly source: number,
        public readonly native: TNative,
        private readonly driver: IPlatformDriver<TNative>,
        private readonly components: Map<PlayerComponentCtor, unknown>,
    ) {}

    /**
     * Sends an event to this player's client. Routes through the driver's
     * `emitClient` — no-op on drivers that do not implement it.
     */
    public emit(event: string, ...args: unknown[]): void {
        if (!this.driver.emitClient) return;
        this.driver.emitClient(this.native, event, ...args);
    }

    /**
     * Invokes an RPC on this player's client and awaits its result. Failures
     * are surfaced as {@link RpcError} using the standard {@link RpcErrorCode}
     * taxonomy.
     */
    public invoke<T = unknown>(rpcName: string, ...args: unknown[]): Promise<T> {
        if (!this.driver.invokeClient) {
            return Promise.reject(
                new RpcError('Driver does not support invokeClient', RpcErrorCode.DISPATCH_FAILED),
            );
        }
        return this.driver.invokeClient<T>(this.native, rpcName, ...args);
    }

    /**
     * Retrieves an attached component. Throws when the component was never
     * registered on the framework — catches programmer errors early rather
     * than returning `undefined` and forcing null-checks at every call site.
     */
    public get<C>(ctor: PlayerComponentCtor<C>): C {
        const instance = this.components.get(ctor);
        if (instance === undefined) {
            throw new Error(
                `[Aurora] Player component "${ctor.name}" is not attached. ` +
                    `Did you register it via @PlayerComponent() and include its module?`,
            );
        }
        return instance as C;
    }

    /** Whether a component of the given type is attached to this player. */
    public has(ctor: PlayerComponentCtor): boolean {
        return this.components.has(ctor);
    }
}
