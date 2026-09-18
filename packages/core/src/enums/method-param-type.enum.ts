/**
 * Types of parameters that can be injected into controller event handlers.
 * Used by the parameter decorators to determine what data to supply.
 *
 * @public
 */
export enum MethodParamType {
    /**
     * Injects the entire event payload object as the parameter value.
     */
    PAYLOAD = 'payload',

    /**
     * Injects a specific property from the event payload.
     * The decorator’s `data` argument specifies the key to extract.
     */
    PARAM = 'param',

    /**
     * Injects the player instance associated with the event,
     * if the event context provides one.
     */
    PLAYER = 'player',

    /**
     * Injects the platform-provided source identifier for the event, if available.
     * FIVEM Only
    */
    SOURCE = 'source',
}
