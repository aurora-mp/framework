/**
 * Defines the available event types for controller decorators,
 * indicating which runtime source should trigger the handler.
 *
 * - `ON`: General in-game events from either client or server context.
 * - `ON_CLIENT`: Client-side events only.
 * - `ON_SERVER`: Server-side events only.
 *
 * @public
 */
export enum EventType {
    /**
     * Listens to any event emitted by the platform driver,
     * regardless of client or server origin.
     */
    ON = 'on',

    /**
     * Listens only to client-side events.
     */
    ON_CLIENT = 'onClient',

    /**
     * Listens only to server-side events.
     */
    ON_SERVER = 'onServer',

    /**
     * Listens to events triggered by the single-instance NUI on platforms
     * that use a fetch/callback style bridge (e.g. FiveM's RegisterNuiCallback).
     */
    ON_NUI = 'onNui',
}
