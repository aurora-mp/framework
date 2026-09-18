import { Injectable } from '../decorators/injectable.decorator';
import type { ILogger } from '../interfaces/logger.interface';
import type { IPlatformDriver } from '../interfaces/platform-driver.interface';
import type { Type } from '../types';
import { formatError } from '../utils/format-error';
import { PlayerEntity } from './player';
import type { PlayerComponentCtor, IPlayerComponent } from './player-component';
import { PlayerComponentRegistry } from './component-registry';
import type { PlayerExtenderRegistry } from './player-extender';

/**
 * Function the {@link PlayerRegistry} uses to build fresh component instances
 * from the DI graph. Supplied by the application factory at wiring time — the
 * registry stays decoupled from the container implementation.
 *
 * @public
 */
export type ComponentFactory = <T>(ctor: Type<T>) => Promise<T>;

/**
 * Central store of live {@link Player} wrappers keyed by source id.
 *
 * @public
 */
@Injectable()
export class PlayerRegistry<TNative = unknown> {
    private readonly players = new Map<number, PlayerEntity<TNative>>();
    private driver!: IPlatformDriver<TNative>;
    private componentRegistry!: PlayerComponentRegistry;
    private extenderRegistry?: PlayerExtenderRegistry;
    private componentFactory!: ComponentFactory;
    private cancelPlayerRpcs?: (source: number, reason: string) => void;
    private logger: ILogger = console;

    /**
     * Two-stage init because the registry is registered in DI before the
     * driver, factory, and other registries are available. Called exactly
     * once from the application factory during bootstrap.
     *
     * @internal
     */
    public configure(opts: {
        driver: IPlatformDriver<TNative>;
        componentRegistry: PlayerComponentRegistry;
        componentFactory: ComponentFactory;
        extenderRegistry?: PlayerExtenderRegistry;
        cancelPlayerRpcs?: (source: number, reason: string) => void;
        logger?: ILogger;
    }): void {
        this.driver = opts.driver;
        this.componentRegistry = opts.componentRegistry;
        this.componentFactory = opts.componentFactory;
        if (opts.extenderRegistry) this.extenderRegistry = opts.extenderRegistry;
        if (opts.cancelPlayerRpcs) this.cancelPlayerRpcs = opts.cancelPlayerRpcs;
        if (opts.logger) this.logger = opts.logger;
    }

    /**
     * Returns the wrapper for `source`, or `undefined` when the player is not
     * currently registered (i.e. pre-`playerJoining` or already dropped).
     * Handlers using {@link Player} injection should tolerate `undefined` for
     * pre-join events such as `playerConnecting`.
     */
    public get(source: number): PlayerEntity<TNative> | undefined {
        return this.players.get(source);
    }

    /** Convenience for iterating currently-connected players. */
    public list(): PlayerEntity<TNative>[] {
        return [...this.players.values()];
    }

    /**
     * Creates the wrapper, resolves each registered component, attaches them,
     * then runs each registered extender. Called by the application factory
     * from the driver's normalised join event.
     */
    public async create(source: number): Promise<PlayerEntity<TNative>> {
        if (this.players.has(source)) return this.players.get(source)!;

        const native = this.resolveNative(source);
        const components = new Map<PlayerComponentCtor, unknown>();
        const player = new PlayerEntity<TNative>(source, native, this.driver, components);
        // Publish the wrapper before running attach hooks so components that
        // reach for peers via player.get() during their own onAttach see the
        // in-progress map instead of a not-yet-registered player.
        this.players.set(source, player);

        for (const ctor of this.componentRegistry.list()) {
            try {
                const instance = await this.componentFactory(ctor);
                components.set(ctor, instance);
                const hook = (instance as IPlayerComponent).onAttach;
                if (typeof hook === 'function') await hook.call(instance, player);
            } catch (error) {
                this.logger.error?.(
                    `[Aurora] Player component "${ctor.name}" failed to attach to source ${source}: ${formatError(error)}`,
                );
            }
        }

        if (this.extenderRegistry) {
            await this.extenderRegistry.runAttach(player);
        }

        return player;
    }

    /**
     * Runs `onDetach` for every attached component in reverse-attach order,
     * runs extender teardown, cancels the player's in-flight RPCs, then
     * evicts the wrapper. Idempotent — safe to call multiple times.
     */
    public async destroy(source: number): Promise<void> {
        const player = this.players.get(source);
        if (!player) return;
        await Promise.resolve();

        this.cancelPlayerRpcs?.(source, 'Player disconnected');

        if (this.extenderRegistry) {
            await this.extenderRegistry.runDetach(player);
        }

        const attachedCtors = [...this.componentsOf(player).keys()].reverse();
        for (const ctor of attachedCtors) {
            const instance = this.componentsOf(player).get(ctor);
            const hook = (instance as IPlayerComponent | undefined)?.onDetach;
            if (typeof hook !== 'function') continue;
            try {
                await hook.call(instance, player);
            } catch (error) {
                this.logger.error?.(
                    `[Aurora] Player component "${ctor.name}" failed to detach from source ${source}: ${formatError(error)}`,
                );
            }
        }

        this.players.delete(source);
    }

    private resolveNative(source: number): TNative {
        if (this.driver.resolveNativePlayer) {
            const native = this.driver.resolveNativePlayer(source);
            if (native !== undefined) return native;
        }
        // Fall back to the numeric source. Safe for FiveM (native === source).
        return source as unknown as TNative;
    }

    /**
     * The components map is `private` on {@link Player} so external callers
     * cannot mutate the attach set. The registry owns lifecycle and reaches
     * into the same map it constructed via a keyed accessor.
     */
    private componentsOf(player: PlayerEntity<TNative>): Map<PlayerComponentCtor, unknown> {
        return (player as unknown as { components: Map<PlayerComponentCtor, unknown> }).components;
    }
}
