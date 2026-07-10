import { RpcError } from '../errors/rpc-error';
import { RpcErrorCode } from './rpc-codes';

/**
 * Context passed to {@link RpcFacadeOptions.onError} when a wrapped RPC
 * invocation or handler fails. Useful for observability hooks.
 *
 * @public
 */
export interface RpcErrorContext {
    readonly rpcName: string;
    /** Numeric player id, or `undefined` when the failure is not player-bound. */
    readonly player?: number;
}

/**
 * Options controlling {@link RpcFacade} behaviour.
 *
 * @public
 */
export interface RpcFacadeOptions {
    /**
     * Maximum time (ms) an outbound RPC may spend awaiting a response before
     * being rejected with {@link RpcErrorCode.TIMEOUT}.
     */
    readonly timeoutMs?: number;
    /**
     * Message returned to remote callers when a handler throws a non-{@link RpcError}.
     * Prevents leaking internal error details to untrusted peers.
     */
    readonly genericErrorMessage?: string;
    /**
     * Called for every error surfaced by the facade — both outbound rejections
     * and inbound handler throws. Never throws itself.
     */
    readonly onError?: (error: unknown, context: RpcErrorContext) => void;
}

/**
 * Function shape the facade calls to actually perform the outbound RPC on the
 * underlying transport. Receives an {@link AbortSignal} the facade will fire
 * when the invocation is cancelled (timeout, player drop, or dispose).
 *
 * Implementations should race their transport operation against the signal so
 * the facade's cancellation semantics apply uniformly across drivers.
 *
 * @public
 */
export type RpcSendFn<T> = (signal: AbortSignal) => Promise<T>;

/**
 * Description of a single outbound RPC handed to {@link RpcFacade.invoke}.
 *
 * @public
 */
export interface RpcInvocation<T> {
    readonly rpcName: string;
    /** Numeric player id used to key player-scoped cancellation. */
    readonly player: number;
    readonly send: RpcSendFn<T>;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_GENERIC_ERROR = 'Internal server error';

interface PendingRpc {
    readonly rpcName: string;
    readonly player: number;
    readonly controller: AbortController;
}

/**
 * Wraps outbound RPC invocations and inbound handlers with timeout, cancellation,
 * and error normalisation. Drivers should instantiate one per platform driver
 * instance and use it to implement the {@link IPlatformDriver} RPC methods.
  *
  * @public
*/
export class RpcFacade {
    private readonly pending = new Map<number, Set<PendingRpc>>();
    private readonly timeoutMs: number;
    private readonly genericErrorMessage: string;
    private readonly onError?: RpcFacadeOptions['onError'];
    private disposed = false;
    private nextId = 0;

    public constructor(options: RpcFacadeOptions = {}) {
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.genericErrorMessage = options.genericErrorMessage ?? DEFAULT_GENERIC_ERROR;
        this.onError = options.onError;
    }

    /**
     * Wraps an outbound RPC with timeout, cancellation, and error normalisation.
     * The caller supplies a `send(signal)` that races its transport operation
     * against the abort signal.
     */
    public async invoke<T>(invocation: RpcInvocation<T>): Promise<T> {
        if (this.disposed) {
            throw new RpcError('Driver disposed', RpcErrorCode.DISPOSED);
        }

        const controller = new AbortController();
        const pending: PendingRpc = {
            rpcName: invocation.rpcName,
            player: invocation.player,
            controller,
        };

        let bucket = this.pending.get(invocation.player);
        if (!bucket) {
            bucket = new Set();
            this.pending.set(invocation.player, bucket);
        }
        bucket.add(pending);

        const timeoutId = setTimeout(() => {
            controller.abort(
                new RpcError(
                    `RPC '${invocation.rpcName}' to player ${invocation.player} timed out`,
                    RpcErrorCode.TIMEOUT,
                ),
            );
        }, this.timeoutMs);
        (timeoutId as { unref?: () => void }).unref?.();

        try {
            const result = await invocation.send(controller.signal);
            return result;
        } catch (error: unknown) {
            const normalised = this.normaliseOutbound(error, controller.signal);
            this.reportError(normalised, { rpcName: invocation.rpcName, player: invocation.player });
            throw normalised;
        } finally {
            clearTimeout(timeoutId);
            bucket.delete(pending);
            if (bucket.size === 0) this.pending.delete(invocation.player);
        }
    }

    /**
     * Wraps an inbound RPC handler. Guarantees:
     *
     * - Synchronous throws become promise rejections (so the driver's response
     *   path always fires — no client hangs waiting for its own timeout)
     * - {@link RpcError} messages are forwarded as-is
     * - Other errors are replaced with {@link RpcFacadeOptions.genericErrorMessage}
     *   before being returned to the peer
     * - Every error is surfaced through {@link RpcFacadeOptions.onError}
     */
    public wrapHandler<TArgs extends unknown[], TResult>(
        rpcName: string,
        handler: (...args: TArgs) => Promise<TResult> | TResult,
    ): (...args: TArgs) => Promise<{ result?: TResult; error?: string }> {
        return async (...args: TArgs) => {
            try {
                const result = await handler(...args);
                return { result };
            } catch (error: unknown) {
                this.reportError(error, { rpcName });
                const message = error instanceof RpcError ? error.message : this.genericErrorMessage;
                return { error: message };
            }
        };
    }

    /**
     * Cancels every in-flight invocation targeting `player` with a
     * {@link RpcErrorCode.PLAYER_DROPPED} error. Called by drivers from their
     * `playerDropped` / `playerQuit` listeners.
     */
    public cancelPlayer(player: number, reason: string = 'Player disconnected'): void {
        const bucket = this.pending.get(player);
        if (!bucket) return;
        this.pending.delete(player);
        const error = new RpcError(reason, RpcErrorCode.PLAYER_DROPPED);
        for (const pending of bucket) pending.controller.abort(error);
    }

    /**
     * Aborts every in-flight invocation with {@link RpcErrorCode.DISPOSED} and
     * puts the facade into a terminal state. Subsequent calls to `invoke`
     * throw synchronously.
     */
    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        const error = new RpcError('Driver disposed', RpcErrorCode.DISPOSED);
        for (const bucket of this.pending.values()) {
            for (const pending of bucket) pending.controller.abort(error);
        }
        this.pending.clear();
    }

    /**
     * Reserved for drivers that want per-invocation ids without maintaining
     * their own counter (matches the FiveM correlation scheme).
     */
    public nextRequestId(): string {
        return String(++this.nextId);
    }

    private normaliseOutbound(error: unknown, signal: AbortSignal): RpcError {
        if (error instanceof RpcError) return error;
        // AbortController.abort(reason) surfaces the reason as the signal's
        // .reason and as the rejection value when send() honours the signal.
        // If the driver's transport rejected with something else we still want
        // to report the abort reason first, so callers see TIMEOUT / DROPPED /
        // DISPOSED instead of a generic string.
        if (signal.aborted && signal.reason instanceof RpcError) return signal.reason;
        const message = error instanceof Error ? error.message : String(error);
        return new RpcError(message, RpcErrorCode.CLIENT_ERROR);
    }

    private reportError(error: unknown, context: RpcErrorContext): void {
        if (!this.onError) return;
        try {
            this.onError(error, context);
        } catch {
            /* observability hook must not itself throw into the transport */
        }
    }
}
