import { createRpcDecorator, RpcType } from '@aurora-mp/core';

/**
 * Binds a client controller method to an RPC invoked by the single-instance
 * NUI (e.g. FiveM's `RegisterNuiCallback` bridge). The handler receives the
 * JSON payload sent by the NUI; its return value is serialized and sent back
 * as the fetch response body.
 *
 * @typeParam E - Literal type of the RPC name.
 * @param rpcName - Optional custom RPC name; if omitted, the method name is used.
 * @returns A method decorator that registers the handler under RpcType.ON_NUI.
 */
export function OnNuiRpc<E extends string>(rpcName?: E): MethodDecorator {
    return createRpcDecorator(RpcType.ON_NUI, rpcName);
}
