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
     * The platform's numeric id for this player. Alias for {@link source}
     * exposed to keep code portable with RAGE-MP's `player.id` idiom.
     */
    public get id(): number {
        return this.source;
    }

    /** Display name reported by the platform. `undefined` if not resolvable. */
    public get name(): string | undefined {
        return this.driver.getPlayerName?.(this.source);
    }

    /** Current world position, or `undefined` if the driver cannot resolve it. */
    public get position(): { x: number; y: number; z: number } | undefined {
        return this.driver.getPlayerPosition?.(this.source);
    }

    /** Current heading (yaw, degrees). */
    public get heading(): number | undefined {
        return this.driver.getPlayerHeading?.(this.source);
    }

    /** Current dimension / routing bucket. */
    public get dimension(): number | undefined {
        return this.driver.getPlayerDimension?.(this.source);
    }
    public set dimension(value: number) {
        this.driver.setPlayerDimension?.(this.source, value);
    }

    /**
     * Current vehicle handle. Platform-specific type (VehicleMp on RAGE-MP,
     * entity handle on FiveM). Consumers reading this should cast to the
     * expected platform type.
     */
    public get vehicle(): unknown {
        return this.driver.getPlayerVehicle?.(this.source);
    }

    /** Current model hash. */
    public get model(): number | undefined {
        return this.driver.getPlayerModel?.(this.source);
    }
    public set model(value: number) {
        this.driver.setPlayerModel?.(this.source, value);
    }

    /** Current health. */
    public get health(): number | undefined {
        return this.driver.getPlayerHealth?.(this.source);
    }
    public set health(value: number) {
        this.driver.setPlayerHealth?.(this.source, value);
    }

    /**
     * Stores an arbitrary key/value pair on the platform's replicated player
     * variable store. Mirrors RAGE-MP's `player.setVariable` API.
     */
    public setVariable(key: string, value: unknown): void {
        this.driver.setPlayerVariable?.(this.source, key, value);
    }

    /** Reads a variable previously stored via {@link setVariable}. */
    public getVariable(key: string): unknown {
        return this.driver.getPlayerVariable?.(this.source, key);
    }

    /**
     * Alias for {@link emit} kept for parity with RAGE-MP's `player.call`
     * client-event API. Accepts either variadic args or a single args array,
     * matching RAGE-MP's overload behaviour.
     */
    public call(event: string, ...args: unknown[]): void {
        const payload = args.length === 1 && Array.isArray(args[0]) ? (args[0] as unknown[]) : args;
        this.emit(event, ...payload);
    }

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
