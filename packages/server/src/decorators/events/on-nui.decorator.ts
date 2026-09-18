import { createEventDecorator, EventType, NUI_ID } from '@aurora-mp/core';

/**
 * Binds a server controller method to an event emitted from the single-instance
 * NUI (e.g. FiveM's per-resource CEF context).
 *
 * @typeParam E - Literal type of the event name.
 * @param eventName - Optional custom event name; if omitted, the method name is used.
 * @returns A method decorator that registers the handler under EventType.ON_CLIENT.
 */
export function OnNui<E extends string>(eventName?: E): MethodDecorator {
    return createEventDecorator(EventType.ON_CLIENT, eventName, NUI_ID);
}
