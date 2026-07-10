import { RpcType } from '../enums';
import { CONTROLLER_PARAMS_KEY, CONTROLLER_RPCS_KEY, GUARDS_METADATA_KEY } from '../constants';
import { ExecutionContext, IPlatformDriver } from '../interfaces';
import { PlayerRegistry } from '../player/player-registry';
import { RpcMetadata, Type } from '../types';
import { ControllerFlowHandler } from './controller-flow.handler';

export class RpcBinder {
    constructor(
        private readonly platformDriver: IPlatformDriver,
        private readonly flowHandler: ControllerFlowHandler,
        private readonly playerRegistry?: PlayerRegistry,
    ) {}

    public bindControllerRpcs(controllers: [Type, Record<string, unknown>][]) {
        for (const [controllerType, controllerInstance] of controllers) {
            const rpcs: RpcMetadata[] = Reflect.getMetadata(CONTROLLER_RPCS_KEY, controllerType) || [];
            for (const rpc of rpcs) {
                // Attach runtime param metadata
                const params =
                    Reflect.getOwnMetadata(CONTROLLER_PARAMS_KEY, controllerType.prototype, rpc.methodName) || [];
                rpc.params = params;

                // Attach runtime guards metadata
                const guards =
                    Reflect.getOwnMetadata(GUARDS_METADATA_KEY, controllerType.prototype, rpc.methodName) ?? [];
                rpc.guards = guards;

                const dispatcher = this.createDispatcher(controllerInstance, rpc);

                switch (rpc.type) {
                    case RpcType.ON_CLIENT:
                        if (this.platformDriver.onRpcServer) this.platformDriver.onRpcServer(rpc.name, dispatcher);
                        break;
                    case RpcType.ON_SERVER:
                        if (this.platformDriver.onRpcClient) this.platformDriver.onRpcClient(rpc.name, dispatcher);
                        break;
                }
            }
        }
    }

    private createDispatcher(
        instance: Record<string, unknown>,
        rpc: RpcMetadata,
    ): (...args: unknown[]) => Promise<unknown> {
        return async (...args: unknown[]) => {
            const capturedSource = this.platformDriver.getInvocationSource?.();
            const wrappedPlayer =
                capturedSource !== undefined ? this.playerRegistry?.get(capturedSource) : undefined;
            const player =
                rpc.type === RpcType.ON_CLIENT
                    ? (wrappedPlayer ?? capturedSource ?? args[0])
                    : undefined;

            const context: ExecutionContext = {
                name: rpc.name,
                args,
                payload: args,
                player,
                ...(capturedSource !== undefined ? { source: capturedSource } : {}),
                getClass: () => instance.constructor as Type,
                getHandler: () => instance[rpc.methodName] as Function,
                getPlayer: () => player,
            };

            const allowed = await this.flowHandler.canActivate(context);
            if (!allowed) {
                console.warn(`[Aurora] Access denied for RPC "${rpc.name}"`);
                return;
            }

            const methodArgs = this.flowHandler.createArgs(context, rpc);
            return await (instance[rpc.methodName] as (...a: any[]) => any)(...methodArgs);
        };
    }
}
