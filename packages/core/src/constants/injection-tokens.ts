/**
 * The token for the platform-specific configuration loader.
 */
export const CONFIG_LOADER = Symbol.for('aurora:config:loader');

/**
 * Dependency injection token for the config service.
 * Use this symbol to register or retrieve the config instance that
 * handles structured config throughout the application on server-side.
 */
export const CONFIG_SERVICE = Symbol.for('aurora:config:service');

/**
 * Dependency injection token for the global event handling service.
 * Use this symbol to register or retrieve the service responsible for
 * emitting and listening to application-wide events.
 */
export const EVENT_SERVICE = Symbol.for('aurora:event:service');

/**
 * Dependency injection token for the global rpc service.
 * Use this symbol to register or retrieve the service responsible for
 * emitting and listening to application-wide rpcs.
 */
export const RPC_SERVICE = Symbol.for('aurora:rpc:service');

/**
 * Dependency injection token for the logging service.
 * Use this symbol to register or retrieve the logger instance that
 * handles structured logging throughout the application.
 */
export const LOGGER_SERVICE = Symbol.for('aurora:logger:service');

/**
 * Dependency injection token for the platform driver.
 * Use this symbol to register or retrieve the driver that provides
 * platform-specific APIs and runtime integration.
 */
export const PLATFORM_DRIVER = Symbol.for('aurora:platform:driver');

/**
 * Dependency injection token for the WebView service.
 * Use this symbol to register or retrieve the service responsible for
 * creating and managing in-game WebView instances.
 */
export const WEBVIEW_SERVICE = Symbol.for('aurora:webview:service');

/**
 * Dependency injection token for the NUI service.
 * Use this symbol to register or retrieve the service responsible for
 * emitting events and invoking RPCs on the single-instance NUI (e.g. FiveM).
 */
export const NUI_SERVICE = Symbol.for('aurora:nui:service');
