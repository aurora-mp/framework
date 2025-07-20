export interface IWebViewPlatform {
    on(eventName: string, listener: (...args: any[]) => void): void;
    off(eventName: string, listener: (...args: any[]) => void): void;
    onServer(eventName: string, listener: (...args: any[]) => void): void;
    emit(eventName: string, ...args: any[]): void;
    emitServer(eventName: string, ...args: any[]): void;

    /**
     * Invoke a client-side RPC; returns a Promise of the result.
     *
     * @param rpcName - the RPC identifier
     * @param args - arguments to pass to the RPC handler on the client
     * @returns a Promise resolving to the handler’s return value
     */
    invokeClientRpc<TResult = unknown>(rpcName: string, ...args: any[]): Promise<TResult>;

    /**
     * Register a handler for RPC calls coming from the client.
     *
     * @param rpcName - the RPC identifier
     * @param handler - async function to handle the call
     */
    onClientRpc<TArgs extends unknown[] = any[], TResult = unknown>(
        rpcName: string,
        handler: (...args: TArgs) => Promise<TResult> | TResult,
    ): void;

    invokeServerRpc<TResult = unknown>(rpcName: string, ...args: any[]): Promise<TResult>;
}
