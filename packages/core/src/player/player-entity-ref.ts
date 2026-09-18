import { PlayerEntity } from './player';
import type { PlayerRegistry } from './player-registry';

const PLAYER_ENTITY_REF_KIND = '@@aurora/player-entity-ref';

/**
 * Wire-safe stand-in for a `PlayerEntity` crossing a transport that
 * serializes its arguments — FiveM's `emit`/`on` msgpack-encode payloads even
 * for same-resource, same-process events, which drops a class instance's
 * prototype methods. `encodePlayerRefs`/`decodePlayerRefs` swap a
 * `PlayerEntity` for this plain shape on the way out and rehydrate it via
 * {@link PlayerRegistry} on the way back in.
 */
export interface PlayerEntityRef {
    readonly kind: typeof PLAYER_ENTITY_REF_KIND;
    readonly source: number;
}

export function isPlayerEntityRef(value: unknown): value is PlayerEntityRef {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { kind?: unknown }).kind === PLAYER_ENTITY_REF_KIND
    );
}

/** Replaces any `PlayerEntity` in `args` with a serializable {@link PlayerEntityRef}. */
export function encodePlayerRefs(args: readonly unknown[]): unknown[] {
    return args.map((arg) =>
        arg instanceof PlayerEntity ? ({ kind: PLAYER_ENTITY_REF_KIND, source: arg.source } satisfies PlayerEntityRef) : arg,
    );
}

/**
 * Resolves any {@link PlayerEntityRef} in `args` back into a live
 * `PlayerEntity` via `registry`. A ref for a player no longer connected
 * decodes to `undefined`, same as `PlayerRegistry.get` would return.
 */
export function decodePlayerRefs(args: readonly unknown[], registry: PlayerRegistry | undefined): unknown[] {
    if (!registry) return args as unknown[];
    return args.map((arg) => (isPlayerEntityRef(arg) ? registry.get(arg.source) : arg));
}
