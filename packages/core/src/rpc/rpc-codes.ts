/**
 * Standard error codes emitted by {@link RpcFacade} and the platform drivers
 * that wrap it. Drivers may add their own codes but must reuse these for the
 * matching failure modes so downstream code can rely on a single taxonomy.
 *
 * @public
 */
export const RpcErrorCode = {
    /** The RPC did not complete within the configured timeout. */
    TIMEOUT: 'RPC_TIMEOUT',
    /** The driver was disposed while the RPC was in flight. */
    DISPOSED: 'RPC_DISPOSED',
    /** The target player id was not a valid, live player. */
    BAD_TARGET: 'RPC_BAD_TARGET',
    /** The remote handler threw or rejected. */
    CLIENT_ERROR: 'RPC_CLIENT_ERROR',
    /** The player disconnected while the RPC was in flight. */
    PLAYER_DROPPED: 'RPC_PLAYER_DROPPED',
    /** The platform failed to dispatch the outbound envelope. */
    DISPATCH_FAILED: 'RPC_DISPATCH_FAILED',
    /** Generic catch-all for otherwise unclassified transport errors. */
    UNKNOWN: 'RPC_ERROR',
} as const;

export type RpcErrorCode = (typeof RpcErrorCode)[keyof typeof RpcErrorCode];
