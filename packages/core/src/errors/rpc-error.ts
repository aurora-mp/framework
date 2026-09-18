/**
 * Structured error thrown across Aurora's RPC transport layer.
 *
 * @public
 */
export class RpcError extends Error {
    public constructor(
        message: string,
        public readonly code: string = 'RPC_ERROR',
    ) {
        super(message);
        this.name = 'RpcError';
    }
}
