import 'reflect-metadata';
import { RpcBinder } from './rpc-binder';
import { ControllerFlowHandler } from './controller-flow.handler';
import { Container } from '../di';
import { createRpcDecorator } from '../decorators';
import { RpcType } from '../enums';
import type { IPlatformDriver } from '../interfaces';
import type { Type } from '../types';

type Ctor = new (...args: any[]) => object;
const bind = (ctor: Ctor) => [ctor as Type, new ctor() as Record<string, unknown>] as [Type, Record<string, unknown>];

const OnClientRpc = (name: string) => createRpcDecorator(RpcType.ON_CLIENT, name);
const OnServerRpc = (name: string) => createRpcDecorator(RpcType.ON_SERVER, name);

function createMockDriver() {
    const onRpcServer = jest.fn();
    const onRpcClient = jest.fn();
    const driver: IPlatformDriver = {
        on: jest.fn(),
        emit: jest.fn(),
        onRpcServer,
        onRpcClient,
    };
    return { driver, onRpcServer, onRpcClient };
}

function createBinder(driver: IPlatformDriver) {
    const flowHandler = new ControllerFlowHandler(new Container());
    return new RpcBinder(driver, flowHandler);
}

describe('RpcBinder', () => {
    describe('@OnClientRpc', () => {
        it('registers the handler on the driver via onRpcServer', () => {
            class TestController {
                @OnClientRpc('testMethod')
                public testMethod(_player: unknown, argument: string) {
                    return { received: argument };
                }
            }

            const { driver, onRpcServer } = createMockDriver();
            createBinder(driver).bindControllerRpcs([bind(TestController)]);

            expect(onRpcServer).toHaveBeenCalledTimes(1);
            const [rpcName, handler] = onRpcServer.mock.calls[0]!;
            expect(rpcName).toBe('testMethod');
            expect(typeof handler).toBe('function');
        });

        it('invokes the underlying method when the registered handler runs', async () => {
            class TestController {
                @OnClientRpc('getData')
                public getData() {
                    return { data: 'test' };
                }
            }

            const { driver, onRpcServer } = createMockDriver();
            createBinder(driver).bindControllerRpcs([bind(TestController)]);

            const handler = onRpcServer.mock.calls[0]![1];
            await expect(handler()).resolves.toEqual({ data: 'test' });
        });
    });

    describe('@OnServerRpc', () => {
        it('registers the handler on the driver via onRpcClient', () => {
            class TestController {
                @OnServerRpc('clientMethod')
                public clientMethod(argument: string) {
                    return { processed: argument };
                }
            }

            const { driver, onRpcClient } = createMockDriver();
            createBinder(driver).bindControllerRpcs([bind(TestController)]);

            expect(onRpcClient).toHaveBeenCalledTimes(1);
            expect(onRpcClient.mock.calls[0]![0]).toBe('clientMethod');
        });

        it('forwards arguments to the underlying method', async () => {
            class TestController {
                @OnServerRpc('handleUpdate')
                public handleUpdate(player: unknown, data: string) {
                    return { updated: true, player, data };
                }
            }

            const { driver, onRpcClient } = createMockDriver();
            createBinder(driver).bindControllerRpcs([bind(TestController)]);

            const handler = onRpcClient.mock.calls[0]![1];
            const player = { id: 1 };
            await expect(handler(player, 'payload')).resolves.toEqual({
                updated: true,
                player,
                data: 'payload',
            });
        });
    });

    describe('multiple decorators on a single controller', () => {
        it('registers each RPC on the correct driver channel', () => {
            class MultiController {
                @OnClientRpc('method1')
                public method1() {
                    return 1;
                }

                @OnClientRpc('method2')
                public method2() {
                    return 2;
                }

                @OnServerRpc('method3')
                public method3() {
                    return 3;
                }
            }

            const { driver, onRpcServer, onRpcClient } = createMockDriver();
            createBinder(driver).bindControllerRpcs([bind(MultiController)]);

            expect(onRpcServer).toHaveBeenCalledTimes(2);
            expect(onRpcClient).toHaveBeenCalledTimes(1);
            expect(onRpcServer.mock.calls.map(([name]) => name)).toEqual(['method1', 'method2']);
            expect(onRpcClient.mock.calls[0]![0]).toBe('method3');
        });
    });

    describe('async handlers', () => {
        it('awaits the underlying async method', async () => {
            class AsyncController {
                @OnClientRpc('asyncMethod')
                public async asyncMethod() {
                    await new Promise((resolve) => setTimeout(resolve, 5));
                    return { completed: true };
                }
            }

            const { driver, onRpcServer } = createMockDriver();
            createBinder(driver).bindControllerRpcs([bind(AsyncController)]);

            const handler = onRpcServer.mock.calls[0]![1];
            await expect(handler()).resolves.toEqual({ completed: true });
        });
    });
});
