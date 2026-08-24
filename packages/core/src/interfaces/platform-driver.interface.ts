import { Unsubscribe } from '../types/unsubscribe.type';
import { IWebView } from './webview.interface';

/**
 * Defines an abstraction over the underlying multiplayer platform’s
 * event, RPC, and WebView mechanisms. Implement this interface to
 * integrate Aurora with a specific platform driver.
 *
 * @template TPlayer - The native player type provided by the platform
 *   (e.g., server or client player object).
 * @public
 */
export interface IPlatformDriver<TPlayer = unknown> {
    /**
     * Initializes the driver and registers its internal listeners. This method
     * must be called once after construction and before any other method.
     * Calling it more than once throws an error.
     *
     * @returns The driver instance for chaining.
     */
    init?(): this;

    /**
     * Disposes the driver and unregisters all its internal listeners. This method
     * must be called once on resource stop, after the application has been closed.
     * Calling it more than once has no effect.
     */
    dispose?(): void;

    /**
     * Registers a listener for a general platform event. Implementations MAY
     * return an {@link Unsubscribe} handle; consumers must tolerate `void`.
     *
     * @param eventName - The event identifier (e.g., 'playerConnect', 'resourceStart').
     * @param listener - Called with the raw event arguments when the event fires.
     */
    on(eventName: string, listener: (...args: unknown[]) => void): void | Unsubscribe;

    /**
     * Unregisters a listener for a general platform event.
     *
     * @param eventName - The event identifier.
     * @param listener - The callback to remove.
     */
    off?(eventName: string, listener: (...args: unknown[]) => void): void;

    /**
     * Registers a listener for a client-originated event. Implementations MAY
     * return an {@link Unsubscribe} handle; consumers must tolerate `void`.
     *
     * @param eventName - The client event identifier.
     * @param listener - Called with the player instance and event arguments.
     */
    onClient?(eventName: string, listener: (player: TPlayer, ...args: unknown[]) => void): void | Unsubscribe;

    /**
     * Registers a listener for a server-originated event (client-side only
     * Implementations MAY return an {@link Unsubscribe} handle;
     * consumers must tolerate `void`.
     *
     * @param eventName - The server event identifier.
     * @param listener - Called with the event arguments as sent by the server.
     */
    onServer?(eventName: string, listener: (...args: unknown[]) => void): void | Unsubscribe;

    /**
     * Emits a general event to all listeners (server or client).
     *
     * @param eventName - The event identifier to emit.
     * @param args - Arguments to pass to the event handlers.
     */
    emit(eventName: string, ...args: unknown[]): void;

    /**
     * Emits a server-specific event to all server-side listeners.
     *
     * @param eventName - The server event identifier to emit.
     * @param args - Arguments to pass to the server handlers.
     */
    emitServer?(eventName: string, ...args: unknown[]): void;

    /**
     * Emits a client-specific event to a single player.
     *
     * @param player - The target player instance.
     * @param eventName - The client event identifier to emit.
     * @param args - Arguments to pass to the client handler.
     */
    emitClient?(player: TPlayer, eventName: string, ...args: unknown[]): void;

    /**
     * Invokes a server-side RPC and returns its result.
     *
     * @typeParam T - The expected return type of the RPC.
     * @param rpcName - The RPC channel identifier.
     * @param args - Arguments to pass to the RPC handler.
     * @returns A promise resolving with the RPC result.
     */
    invokeServer?<T = any>(rpcName: string, ...args: unknown[]): Promise<T>;

    /**
     * Invokes a client-side RPC on a specific player and returns its result.
     *
     * @typeParam T - The expected return type of the RPC.
     * @param player - The target player instance.
     * @param rpcName - The RPC channel identifier.
     * @param args - Arguments to pass to the RPC handler.
     * @returns A promise resolving with the RPC result.
     */
    invokeClient?<T = any>(player: TPlayer, rpcName: string, ...args: unknown[]): Promise<T>;

    /**
     * Registers a handler for client-initiated RPC calls. Implementations MAY
     * return an {@link Unsubscribe} handle; consumers must tolerate `void`.
     *
     * @param rpcName - The RPC channel identifier.
     * @param handler - Function to handle incoming RPC requests.
     */
    onRpcClient?(
        rpcName: string,
        handler: (...args: unknown[]) => Promise<unknown> | unknown,
    ): void | Unsubscribe;

    /**
     * Registers a handler for server-initiated RPC calls. Implementations MAY
     * return an {@link Unsubscribe} handle; consumers must tolerate `void`.
     *
     * @param rpcName - The RPC channel identifier.
     * @param handler - Function to handle incoming RPC requests.
     */
    onRpcServer?(
        rpcName: string,
        handler: (...args: unknown[]) => Promise<unknown> | unknown,
    ): void | Unsubscribe;

    /**
     * Returns the platform source identifier for the event currently being
     * dispatched, if any.
     * This is useful for determining which player triggered an event or RPC.
    */
    getInvocationSource?(): number | undefined;

    /**
     * Resolves the native (platform-specific) representation of a player
     * from its numeric source id. FiveM returns the source itself; RAGE-MP
     * returns a `PlayerMp` object. Used by the framework's `PlayerRegistry`
     * to build a uniform {@link Player} wrapper.
     *
     * Returns `undefined` when no player currently matches the id (dropped,
     * or pre-join).
     */
    resolveNativePlayer?(source: number): TPlayer | undefined;

    /**
     * @internal
     * Wraps the platform's player join moment, normalised across platforms:
     * - FiveM: `playerConnecting`
     * - RAGE-MP: `playerJoin`
     *
     * @param listener - Called with the source id of the joining player.
     * @returns An {@link Unsubscribe} handle where possible; consumers must tolerate `void`.
    */
    onPlayerJoin?(listener: (source: number) => void): void | Unsubscribe;

    /**
     * @internal
     * Wraps the platform's player drop moment, normalised across platforms:
     * - FiveM: `playerDropped`
     * - RAGE-MP: `playerQuit`
     * 
     * @param listener - Called with the source id of the dropping player and an optional reason.
     * @returns An {@link Unsubscribe} handle where possible; consumers must tolerate `void`.
     */
    onPlayerDrop?(listener: (source: number, reason?: string) => void): void | Unsubscribe;

    /**
     * Creates a new WebView instance on the client side.
     *
     * @param id - Unique identifier for the WebView instance.
     * @param url - The URL to load in the WebView.
     * @param focused - Whether the WebView should be focused on creation.
     * @param hidden - Whether the WebView should be hidden initially.
     * @returns A platform‐agnostic {@link IWebView} wrapper.
     */
    createWebview?(id: string | number, url: string, focused: boolean, hidden: boolean): IWebView;

    /**
     * Destroys an existing WebView instance.
     *
     * @param id - The unique identifier of the WebView to destroy.
     */
    destroyWebview?(id: string | number): void;

    /**
     * Registers the messaging handle for the single-instance NUI that
     * platforms like FiveM expose per resource. Unlike `createWebview`, this
     * does not accept a URL because the NUI page is declared by the platform
     * manifest (e.g. `ui_page` in `fxmanifest.lua`).
     *
     * @param id - Identifier used to route messages internally.
     * @param focused - Whether the NUI should receive input focus at init.
     * @param cursor - Whether the mouse cursor should be visible at init.
     * @returns A platform-agnostic {@link IWebView} wrapper for messaging.
     */
    createNuiDriver?(id: string | number, focused: boolean, cursor: boolean): IWebView;

    /**
     * Registers a handler for a callback invoked by the NUI page (e.g. via
     * `fetch('https://cfx-nui-<res>/name')` on FiveM). The handler receives
     * the JSON payload from the NUI and returns a value that is sent back as
     * the fetch response body. Returning `undefined` still unblocks the fetch
     * with an empty object.
     *
     * @param name - Callback name registered on the platform side.
     * @param handler - Called with the payload from the NUI.
     * @returns An {@link Unsubscribe} handle where the platform allows removal.
     */
    onNuiCallback?(name: string, handler: (payload: unknown) => Promise<unknown> | unknown): void | Unsubscribe;

    /**
     * Reads the display name of the player identified by `source`. Backs the
     * `PlayerEntity.name` getter. Return `undefined` when the platform cannot
     * resolve the player (dropped, or pre-join).
     */
    getPlayerName?(source: number): string | undefined;

    /**
     * Reads the player's current world position. Backs `PlayerEntity.position`.
     */
    getPlayerPosition?(source: number): { x: number; y: number; z: number } | undefined;

    /**
     * Reads the player's current heading (yaw, in degrees). Backs
     * `PlayerEntity.heading`.
     */
    getPlayerHeading?(source: number): number | undefined;

    /**
     * Reads the player's current dimension / routing bucket. Backs
     * `PlayerEntity.dimension` getter.
     */
    getPlayerDimension?(source: number): number | undefined;

    /**
     * Sets the player's dimension / routing bucket. Backs
     * `PlayerEntity.dimension` setter.
     */
    setPlayerDimension?(source: number, dimension: number): void;

    /**
     * Reads the vehicle the player is currently in, or `undefined` when on
     * foot. Return type is platform-specific (e.g. `VehicleMp` on RAGE-MP,
     * numeric entity handle on FiveM).
     */
    getPlayerVehicle?(source: number): unknown;

    /**
     * Reads the player's current model hash. Backs `PlayerEntity.model` getter.
     */
    getPlayerModel?(source: number): number | undefined;

    /**
     * Sets the player's model. Backs `PlayerEntity.model` setter.
     */
    setPlayerModel?(source: number, model: number): void;

    /**
     * Reads the player's current health. Backs `PlayerEntity.health` getter.
     */
    getPlayerHealth?(source: number): number | undefined;

    /**
     * Sets the player's health. Backs `PlayerEntity.health` setter.
     */
    setPlayerHealth?(source: number, health: number): void;

    /**
     * Stores an arbitrary key/value pair replicated to the player's client.
     * Modelled after RAGE-MP's `player.setVariable`; FiveM drivers may back
     * this with statebags. Backs `PlayerEntity.setVariable`.
     */
    setPlayerVariable?(source: number, key: string, value: unknown): void;

    /**
     * Reads a previously set variable. Backs `PlayerEntity.getVariable`.
     */
    getPlayerVariable?(source: number, key: string): unknown;
}
