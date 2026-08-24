import { createRpcDecorator, NUI_ID, RpcType } from '@aurora-mp/core';

/**
 * Binds a server controller method to an RPC invoked from the single-instance
 * NUI (e.g. FiveM's per-resource CEF context).
 * 
 * @typeParam E - Literal type of the RPC name.
 * @param rpcName - Optional custom RPC name; if omitted, the method name is used.
 * @returns A method decorator that registers the handler under RpcType.ON_CLIENT.
 */
export function OnNuiRpc<E extends string>(rpcName?: E): MethodDecorator {
    return createRpcDecorator(RpcType.ON_CLIENT, rpcName, NUI_ID);
}
