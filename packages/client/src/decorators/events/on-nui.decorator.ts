import { createEventDecorator, EventType } from '@aurora-mp/core';

/**
 * Binds a client controller method to an event triggered by the single-instance
 * NUI (e.g. FiveM's `RegisterNuiCallback` bridge). The handler receives the
 * JSON payload sent by the NUI. Its return value is ignored, but the
 * underlying fetch is unblocked automatically.
 *
 * @typeParam E - Literal type of the event name.
 * @param eventName - Optional custom event name; if omitted, the method name is used.
 * @returns A method decorator that registers the handler under EventType.ON_NUI.
 */
export function OnNui<E extends string>(eventName?: E): MethodDecorator {
    return createEventDecorator(EventType.ON_NUI, eventName);
}
