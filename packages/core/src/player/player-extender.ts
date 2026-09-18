import { Injectable } from '../decorators/injectable.decorator';
import { Container } from '../di/container';
import type { ILogger } from '../interfaces/logger.interface';
import { formatError } from '../utils/format-error';
import type { PlayerEntity } from './player';

/**
 * Escape-hatch counterpart to {@link PlayerComponent}. Where a component is
 * a typed, DI-resolved, per-player object retrieved via `player.get(...)`,
 * an extender is a plain function that mutates the wrapper's `ext` bag on
 * join. Useful for prototyping and one-off augmentations where a full
 * component would be overkill.
 *
 * Type augmentation is opt-in: users who want their `ext` fields typed
 * declare a `declare module '@aurora-mp/core'` block augmenting {@link Player}.
 *
 * @public
 */
export interface PlayerExtender {
    /** Called after all components are attached, in registration order. */
    onAttach(player: PlayerEntity, container: Container): void | Promise<void>;
    /** Called before components are detached, in reverse registration order. */
    onDetach?(player: PlayerEntity, container: Container): void | Promise<void>;
}

/**
 * Registry the application factory populates with declarative extenders
 * (object instances registered via `app.extendPlayer(...)` or the module
 * `playerExtenders` metadata) and hands to {@link PlayerRegistry}.
 *
 * @public
 */
@Injectable()
export class PlayerExtenderRegistry {
    private readonly extenders: PlayerExtender[] = [];
    private container?: Container;
    private logger: ILogger = console;

    /** Called once by the application factory during bootstrap. @internal */
    public configure(opts: { container: Container; logger?: ILogger }): void {
        this.container = opts.container;
        if (opts.logger) this.logger = opts.logger;
    }

    /** Register an extender. Order is preserved for attach and reversed for detach. */
    public register(extender: PlayerExtender): void {
        this.extenders.push(extender);
    }

    /** @internal — called by {@link PlayerRegistry.create}. */
    public async runAttach(player: PlayerEntity): Promise<void> {
        if (!this.container) return;
        for (const extender of this.extenders) {
            try {
                await extender.onAttach(player, this.container);
            } catch (error) {
                this.logger.error?.(
                    `[Aurora] Player extender failed to attach on source ${player.source}: ${formatError(error)}`,
                );
            }
        }
    }

    /** @internal — called by {@link PlayerRegistry.destroy}. */
    public async runDetach(player: PlayerEntity): Promise<void> {
        if (!this.container) return;
        for (let i = this.extenders.length - 1; i >= 0; i--) {
            const extender = this.extenders[i];
            if (!extender?.onDetach) continue;
            try {
                await extender.onDetach(player, this.container);
            } catch (error) {
                this.logger.error?.(
                    `[Aurora] Player extender failed to detach on source ${player.source}: ${formatError(error)}`,
                );
            }
        }
    }
}
