import { RpcType } from '../enums';
import { CONTROLLER_PARAMS_KEY, CONTROLLER_RPCS_KEY, GUARDS_METADATA_KEY } from '../constants';
import type { ExecutionContext, ILogger, IPlatformDriver } from '../interfaces';
import { PlayerRegistry } from '../player/player-registry';
import { RpcMetadata, Type } from '../types';
import { ControllerFlowHandler } from './controller-flow.handler';

export class RpcBinder {
    constructor(
        private readonly platformDriver: IPlatformDriver,
        private readonly flowHandler: ControllerFlowHandler,
        private readonly playerRegistry?: PlayerRegistry,
    ) {}

    private get logger(): ILogger {
        return this.flowHandler.logger;
    }

    public bindControllerRpcs(controllers: [Type, Record<string, unknown>][]) {
        for (const [controllerType, controllerInstance] of controllers) {
            const rpcs: RpcMetadata[] = Reflect.getMetadata(CONTROLLER_RPCS_KEY, controllerType) || [];
            for (const rpc of rpcs) {
                const params =
                    Reflect.getOwnMetadata(CONTROLLER_PARAMS_KEY, controllerType.prototype, rpc.methodName) || [];
                rpc.params = params;

                const guards =
                    Reflect.getOwnMetadata(GUARDS_METADATA_KEY, controllerType.prototype, rpc.methodName) ?? [];
                rpc.guards = guards;

                const dispatcher = this.createDispatcher(controllerInstance, rpc);

                switch (rpc.type) {
                    case RpcType.ON_CLIENT:
                        if (!this.platformDriver.onRpcServer) {
                            this.warnUnsupported(rpc.type);
                            break;
                        }
                        this.platformDriver.onRpcServer(rpc.name, dispatcher);
                        break;
                    case RpcType.ON_SERVER:
                        if (!this.platformDriver.onRpcClient) {
                            this.warnUnsupported(rpc.type);
                            break;
                        }
                        this.platformDriver.onRpcClient(rpc.name, dispatcher);
                        break;
                    case RpcType.ON_NUI:
                        if (!this.platformDriver.onNuiCallback) {
                            this.warnUnsupported(rpc.type);
                            break;
                        }
                        this.platformDriver.onNuiCallback(rpc.name, (payload) => dispatcher(payload));
                        break;
                    default:
                        this.logger.warn(`[Aurora] Unknown RPC type "${rpc.type}" for RPC "${rpc.name}".`);
                }
            }
        }
    }

    private warnUnsupported(rpcType: RpcType) {
        this.logger.warn(
            `[Aurora] Driver ${this.platformDriver.constructor.name} does not support RPC type "${rpcType}".`,
        );
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
                this.logger.warn(`[Aurora] Access denied for RPC "${rpc.name}"`);
                return;
            }

            const rpcArgs = rpc.type === RpcType.ON_CLIENT ? [player, ...args] : args;
            const methodArgs = this.flowHandler.createArgs({ ...context, args: rpcArgs, payload: rpcArgs }, rpc);
            return await (instance[rpc.methodName] as (...a: any[]) => any)(...methodArgs);
        };
    }
}
