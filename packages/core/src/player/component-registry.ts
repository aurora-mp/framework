import { Injectable } from '../decorators/injectable.decorator';
import type { Type } from '../types';
import { isPlayerComponent, type PlayerComponentCtor } from './player-component';

/**
 * Registry the application factory populates with declarative components
 * (class constructors registered via `@PlayerComponent()` or the module
 * `playerComponents` metadata) and hands to {@link PlayerRegistry}.
 * @public
 */
@Injectable()
export class PlayerComponentRegistry {
    private readonly components: PlayerComponentCtor[] = [];
    private readonly seen = new Set<PlayerComponentCtor>();

    /**
     * Registers a component class constructor. Order is preserved for attach and reversed for detach.
     * @param target - The component class constructor to register.
     */
    public register(target: Type): void {
        if (!isPlayerComponent(target)) return;
        if (this.seen.has(target as PlayerComponentCtor)) return;
        this.seen.add(target as PlayerComponentCtor);
        this.components.push(target as PlayerComponentCtor);
    }

    /**
      * Returns a read-only array of all registered component class constructors.
      * @returns An array of registered component class constructors.
    */
    public list(): readonly PlayerComponentCtor[] {
        return this.components;
    }
}
