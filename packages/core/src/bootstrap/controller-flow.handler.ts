import { EventMetadata, RpcMetadata, Type } from '../types';
import { ExecutionContext, Guard, ILogger, MethodParameter } from '../interfaces';
import { MethodParamType } from '../enums';
import { GUARDS_METADATA_KEY } from '../constants';
import { Container } from '../di';

/**
 * Orchestrates the execution pipeline for controller/service methods:
 * - Resolves method parameters (via decorators)
 * - Executes guards if defined
 * - Invokes the decorated method on the instance
 */
export class ControllerFlowHandler {
    private logger: ILogger = console;

    constructor(private readonly container: Container) {}

    public setLogger(logger: ILogger) {
        this.logger = logger;
    }

    /**
     * Maps the ExecutionContext to an array of arguments for the controller method.
     * @param context The current execution context containing raw arguments.
     * @param event Metadata for the event handler including parameter definitions.
     * @returns An array of arguments to apply to the controller method.
     */
    public createArgs(context: ExecutionContext, handler: EventMetadata | RpcMetadata): unknown[] {
        if (!handler.params?.length) {
            return context.args;
        }

        const sorted: MethodParameter[] = [...handler.params].sort((a, b) => a.index - b.index);
        const rawArgs = context.args;
        const args: unknown[] = [];

        for (const param of sorted) {
            let value: unknown;
            switch (param.type) {
                case MethodParamType.PLAYER:
                    value = param.data ? (rawArgs[0] as any)?.[param.data] : rawArgs[0];
                    break;

                case MethodParamType.PAYLOAD:
                    const payload = rawArgs[1];
                    if (payload != null && typeof payload === 'object') {
                        value = param.data ? (payload as any)?.[param.data] : payload;
                    } else {
                        value = rawArgs.slice(1);
                    }
                    break;

                case MethodParamType.PARAM:
                    const obj = rawArgs[1];
                    if (obj != null && typeof obj === 'object') {
                        value = (obj as any)?.[param.data as string];
                    } else {
                        value = rawArgs[param.index];
                    }
                    break;

                default:
                    throw new Error(`Unknown parameter type ${(param as any).type}`);
            }
            args[param.index] = value;
        }

        return args;
    }

    public async canActivate(context: ExecutionContext): Promise<boolean> {
        const targetClass = context.getClass();
        const handler = context.getHandler();

        const classGuards: Type<Guard>[] = Reflect.getMetadata(GUARDS_METADATA_KEY, targetClass) || [];
        const methodGuards: Type<Guard>[] =
            Reflect.getMetadata(GUARDS_METADATA_KEY, targetClass.prototype, handler.name) || [];

        const allGuards = [...classGuards, ...methodGuards];
        for (const guard of allGuards) {
            const instance = this.container.resolve<Guard>(guard);
            const allowed = await instance.canActivate(context);

            if (!allowed) {
                this.logger.debug(`[Aurora] Access denied by ${guard.name} on ${targetClass.name}.${handler.name}`);
                return false;
            }

            this.logger.debug(`[Aurora] Guard ${guard.name} granted access.`);
        }

        return true;
    }

    public wrapWithGuardsProxy<T extends object>(instance: T, targetClass: Type): T {
        const methodNames = Object.getOwnPropertyNames(targetClass.prototype).filter(
            (name) => name !== 'constructor' && typeof instance[name as keyof T] === 'function',
        );

        return new Proxy(instance, {
            get: (obj, prop, receiver) => {
                if (typeof prop !== 'string' || !methodNames.includes(prop)) {
                    return Reflect.get(obj, prop, receiver);
                }

                const original = Reflect.get(obj, prop, receiver) as Function;

                return async (...args: any[]) => {
                    const ctx: ExecutionContext = {
                        name: `${targetClass.name}.${prop}`,
                        args,
                        payload: args[1] ?? args[0],
                        player: args[0],
                        getClass: () => targetClass,
                        getHandler: () => targetClass.prototype[prop],
                        getPlayer: () => args[0],
                    };

                    if (!(await this.canActivate(ctx))) {
                        this.logger.warn(`[Aurora] Access denied to ${ctx.name}`);
                        return;
                    }

                    return original.apply(obj, args);
                };
            },
        });
    }

    public hasGuards(targetClass: Type): boolean {
        const proto = targetClass.prototype;
        const classGuards = Reflect.getMetadata(GUARDS_METADATA_KEY, targetClass) || [];

        if (classGuards.length) return true;

        return Object.getOwnPropertyNames(proto).some(
            (m) => m !== 'constructor' && (Reflect.getMetadata(GUARDS_METADATA_KEY, proto, m) || []).length > 0,
        );
    }
}
