/**
 * @internal
 * Symbol key for storing module-level metadata (e.g., imports, providers, controllers)
 */
export const MODULE_METADATA_KEY = Symbol.for('aurora:module');

/**
 * @internal
 * Symbol key for marking a module as globally available throughout the application
 */
export const GLOBAL_MODULE_KEY = Symbol.for('aurora:global:module');

/** @internal Symbol key for identifying controller classes within modules */
export const CONTROLLER_METADATA_KEY = Symbol.for('aurora:controller');

/**
 * @internal
 * Symbol key for storing event-handler metadata on controller classes.
 * Each entry maps a method name to its associated event metadata.
 */
export const CONTROLLER_EVENTS_KEY = Symbol.for('aurora:controller:events');

/**
 * @internal
 * Symbol key for storing parameter metadata for controller event handlers.
 * Used to resolve and inject method arguments when an event is invoked.
 */
export const CONTROLLER_PARAMS_KEY = Symbol.for('aurora:controller:params');

/**
 * @internal
 * Symbol key for storing parameter metadata for controller rpc handlers.
 * Used to resolve and inject method arguments when an event is invoked.
 */
export const CONTROLLER_RPCS_KEY = Symbol.for('aurora:controller:rpcs');

/**
 * @internal
 * Unique symbol used as the Reflect metadata key for storing guard classes
 * applied by the `@UseGuard` decorator on a target (class or method).
 */
export const GUARDS_METADATA_KEY = Symbol.for('aurora:guards');

/**
 * @internal
 * Symbol key for storing custom injection tokens assigned to constructor parameters.
 */
export const INJECT_TOKEN_KEY = Symbol.for('aurora:inject');

/**
 * @internal
 * Symbol key for storing metadata about class properties decorated for injection.
 */
export const INJECT_PROPERTY_KEY = Symbol.for('aurora:inject:property');

/**
 * @internal
 * Symbol key for marking classes as injectable services or providers.
 */
export const INJECTABLE_METADATA_KEY = Symbol.for('aurora:injectable');

/**
 * @internal
 * Symbol key for storing scope configuration on injectable classes.
 */
export const INJECTABLE_SCOPE_OPTIONS = Symbol.for('aurora:injectable:scope:options');

/**
 * @internal
 * Symbol key for metadata on individual event handler methods.
 */
export const EVENT_HANDLER_KEY = Symbol.for('aurora:event:handler');
