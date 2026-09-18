import 'reflect-metadata';
import { Injectable } from '../decorators/injectable.decorator';
import { INJECTABLE_METADATA_KEY } from '../constants';
import { Scope } from '../enums';
import type { Type } from '../types';
import type { PlayerEntity } from './player';

/**
 * Metadata key set by {@link PlayerComponent} on the target class. Exposed
 * for tooling and framework extensions that need to detect components via
 * reflection. Regular application code should not need this.
 */
export const PLAYER_COMPONENT_METADATA_KEY = Symbol.for('aurora:player:component');

/**
 * Constructor type for a class registered via {@link PlayerComponent}.
 * @public
 */
export type PlayerComponentCtor<T = unknown> = Type<T>;

/**
 * Lifecycle hooks a player component may implement. Both hooks are optional:
 * a component with no attach/detach behaviour is a plain per-player state
 * container.
 *
 * @public
 */
export interface IPlayerComponent {
    /**
     * Called once, after the component is instantiated and attached to the
     * player wrapper. Use for state hydration, DB reads, or side-effect setup.
     * Throwing here aborts the join flow for this player.
     */
    onAttach?(player: PlayerEntity): void | Promise<void>;
    /**
     * Called once, before the component is detached and the player wrapper
     * is evicted. Use for state persistence and cleanup. Errors are logged
     * but do not block eviction.
     */
    onDetach?(player: PlayerEntity): void | Promise<void>;
}

/**
 * Marks a class as a player component. Components are:
 *
 * - Resolved from the DI container (they can `@Inject(...)` services)
 * - Instantiated once per player at join time and stored on the player wrapper
 * - Retrieved via {@link Player.get} using the class as key
 * - Torn down via {@link IPlayerComponent.onDetach} when the player disconnects
 *
 * Components are automatically discovered by the {@link PlayerComponentRegistry}
 * at bootstrap — no separate registration step is needed. Order of attach
 * follows module scan order; use inter-component references cautiously.
 *
 * @example
 * ```ts
 * @PlayerComponent()
 * export class WalletComponent implements IPlayerComponent {
 *   constructor(@Inject(DATABASE) private db: Database) {}
 *   async onAttach(player: Player) { this.balance = await this.db.load(player.source); }
 *   getBalance() { return this.balance; }
 * }
 * ```
 *
 * @public
 */
export function PlayerComponent(): ClassDecorator {
    return (target) => {
        Reflect.defineMetadata(PLAYER_COMPONENT_METADATA_KEY, true, target);
        if (!Reflect.hasOwnMetadata(INJECTABLE_METADATA_KEY, target)) {
            Injectable({ scope: Scope.TRANSIENT })(target);
        }
    };
}

/**
 * Runtime check: `true` if the class was marked with {@link PlayerComponent}.
 * @public
 */
export function isPlayerComponent(target: Type): boolean {
    return Reflect.getMetadata(PLAYER_COMPONENT_METADATA_KEY, target) === true;
}
