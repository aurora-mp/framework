import { Type } from '@core/types';

/**
 * Provides contextual information for a controller event invocation.
 * An instance of this interface is available to guards, interceptors,
 * and can be injected into handler methods as needed.
 *
 * @public
 */
export interface ExecutionContext {
    /**
     * The name or identifier of the event being handled.
     */
    readonly name: string;

    /**
     * The raw arguments array received from the platform driver for this event.
     */
    readonly args: unknown[];

    /**
     * A convenient reference to the main payload of the event
     * (typically the first element of `args`).
     */
    readonly payload?: unknown;

    /**
     * The player object associated with the event, if one is present
     * in the platform event context.
     */
    readonly player?: unknown;

    /** Platform source id, if available. */
    readonly source?: number;

    /**
     * Returns the class (i.e. controller or provider) that defines the current handler.
     */
    getClass(): Type;

    /**
     * Returns the actual method (function) being executed.
     */
    getHandler(): Function;

    /**
     * Returns the player object, or undefined.
     */
    getPlayer(): unknown;
}
