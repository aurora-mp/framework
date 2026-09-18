import { Injectable, Inject, PLATFORM_DRIVER, WebViewEvents, encodePlayerRefs } from '@aurora-mp/core';
import type { IPlatformDriver } from '@aurora-mp/core';

/**
 * Service for emitting events through the underlying platform driver.
 *
 * Supports:
 * - Global events (`emit`)
 * - Targeted client events (`emitClient`)
 * - WebView events multiplexed via a dispatch channel (`emitWebview`)
 *
 * @typeParam TPlayer - The platform’s player type (e.g. alt.Player, PlayerMp, etc.)
 */
@Injectable()
export class EventService<TPlayer = any> {
    /**
     * @param platformDriver - The platform-specific driver implementation,
     *                         injected via the PLATFORM_DRIVER token.
     */
    constructor(
        @Inject(PLATFORM_DRIVER)
        private readonly platformDriver: IPlatformDriver<TPlayer>,
    ) {}

    /**
     * Emit a global event on the server or client (depending on driver).
     *
     * @param eventName - The name of the event to emit.
     * @param args      - Additional arguments to pass to event listeners.
     */
    public emit(eventName: string, ...args: any[]): void {
        if (!this.platformDriver.emit) {
            console.warn('[Aurora] Warning: The current platform driver does not support emit.');
            return;
        }
        this.platformDriver.emit(eventName, ...encodePlayerRefs(args));
    }

    /**
     * Emit an event to a specific client/player.
     *
     * @param player    - The target player instance.
     * @param eventName - The name of the event to emit to that player.
     * @param args      - Additional arguments to pass to the player's event listener.
     */
    public emitClient(player: TPlayer, eventName: string, ...args: any[]): void {
        if (!this.platformDriver.emitClient) {
            console.warn('[Aurora] Warning: The current platform driver does not support emitClient.');
            return;
        }
        this.platformDriver.emitClient(player, eventName, ...encodePlayerRefs(args));
    }

    /**
     * Emit an event into a WebView owned by a player.
     *
     * This method uses a single multiplex channel (`WebViewEvents.DISPATCH`)
     * to route calls from the game server through the client into the CEF context.
     *
     * @param player     - The player who owns the WebView.
     * @param webviewId  - The identifier of the target WebView.
     * @param eventName  - The name of the WebView event.
     * @param args       - Arguments to pass into the WebView handler.
     */
    public emitWebview(player: TPlayer, webviewId: string | number, eventName: string, ...args: any[]): void {
        if (!this.platformDriver.emitClient) {
            console.warn(
                '[Aurora] Warning: The current platform driver does not support emitClient (used from emitWebview).',
            );
            return;
        }
        // Dispatch via the WebViewEvents.DISPATCH channel
        this.platformDriver.emitClient(player, WebViewEvents.DISPATCH, webviewId, eventName, ...encodePlayerRefs(args));
    }
}
