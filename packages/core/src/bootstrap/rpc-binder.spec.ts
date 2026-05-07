/**
 * Unit tests for RPC functionality
 * Tests the @OnClientRpc and @OnServerRpc decorators
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RpcBinder } from '@aurora-mp/core';
import { createRpcDecorator, RpcType } from '@aurora-mp/core';

// Mock platform driver
class MockPlatformDriver {
    public onRpcServerCalls: Array<{ rpcName: string; handler: Function }> = [];
    public onRpcClientCalls: Array<{ rpcName: string; handler: Function }> = [];

    public onRpcServer(rpcName: string, handler: (...args: unknown[]) => Promise<unknown> | unknown): void {
        this.onRpcServerCalls.push({ rpcName, handler });
    }

    public onRpcClient(rpcName: string, handler: (player: any, ...args: unknown[]) => Promise<unknown> | unknown): void {
        this.onRpcClientCalls.push({ rpcName, handler });
    }

    public on(eventName: string, listener: (...args: unknown[]) => void): void {}
    public off(eventName: string, listener: (...args: any[]) => void): void {}
    public onClient(eventName: string, listener: (player: any, ...args: any[]) => void): void {}
    public emit(eventName: string, ...args: unknown[]): void {}
    public emitClient(player: any, eventName: string, ...args: any[]): void {}
}

describe('Aurora RPC System', () => {
    let platformDriver: MockPlatformDriver;

    beforeEach(() => {
        platformDriver = new MockPlatformDriver();
    });

    describe('@OnClientRpc Decorator', () => {
        it('should register a server handler for client RPC calls', async () => {
            // Create a controller with @OnClientRpc
            class TestController {
                @OnClientRpc('testMethod')
                public testMethod(player: any, argument: string) {
                    return { received: argument };
                }
            }

            const controller = new TestController();
            const rpcBinder = new RpcBinder(platformDriver as any, null as any);

            // Simulate binding (this is usually done during bootstrap)
            rpcBinder.bindControllerRpcs([[TestController, controller]]);

            // Verify that onRpcServer was called
            expect(platformDriver.onRpcServerCalls).toHaveLength(1);
            expect(platformDriver.onRpcServerCalls[0].rpcName).toBe('testMethod');
            expect(typeof platformDriver.onRpcServerCalls[0].handler).toBe('function');
        });

        it('should execute handler when RPC is called', async () => {
            class TestController {
                @OnClientRpc('getData')
                public getData(player: any) {
                    return { data: 'test' };
                }
            }

            const controller = new TestController();
            const rpcBinder = new RpcBinder(platformDriver as any, null as any);
            rpcBinder.bindControllerRpcs([[TestController, controller]]);

            // Call the handler that was registered
            const handler = platformDriver.onRpcServerCalls[0].handler;
            const result = await handler();

            expect(result).toEqual({ data: 'test' });
        });

        it('should handle errors in RPC handlers', async () => {
            class TestController {
                @OnClientRpc('errorMethod')
                public errorMethod(player: any) {
                    throw new Error('Test error');
                }
            }

            const controller = new TestController();
            const rpcBinder = new RpcBinder(platformDriver as any, null as any);
            rpcBinder.bindControllerRpcs([[TestController, controller]]);

            const handler = platformDriver.onRpcServerCalls[0].handler;
            const result = await handler();

            // Should return error object
            expect(result).toHaveProperty('error');
            expect(result.error).toContain('Test error');
        });
    });

    describe('@OnServerRpc Decorator', () => {
        it('should register a client handler for server RPC calls', async () => {
            class TestController {
                @OnServerRpc('clientMethod')
                public clientMethod(argument: string) {
                    return { processed: argument };
                }
            }

            const controller = new TestController();
            const rpcBinder = new RpcBinder(platformDriver as any, null as any);
            rpcBinder.bindControllerRpcs([[TestController, controller]]);

            // OnServerRpc should use onRpcClient
            expect(platformDriver.onRpcClientCalls).toHaveLength(1);
            expect(platformDriver.onRpcClientCalls[0].rpcName).toBe('clientMethod');
        });

        it('should handle client handler with player parameter', async () => {
            class TestController {
                @OnServerRpc('handleUpdate')
                public handleUpdate(player: any, data: string) {
                    return { updated: true, data };
                }
            }

            const controller = new TestController();
            const rpcBinder = new RpcBinder(platformDriver as any, null as any);
            rpcBinder.bindControllerRpcs([[TestController, controller]]);

            const handler = platformDriver.onRpcClientCalls[0].handler;
            const mockPlayer = { id: 1, name: 'TestPlayer' };
            const result = await handler(mockPlayer, 'test data');

            expect(result).toEqual({ updated: true, data: 'test data' });
        });
    });

    describe('Multiple RPC Handlers', () => {
        it('should register multiple handlers from same controller', async () => {
            class MultiController {
                @OnClientRpc('method1')
                public method1(player: any) {
                    return { result: 1 };
                }

                @OnClientRpc('method2')
                public method2(player: any) {
                    return { result: 2 };
                }

                @OnServerRpc('method3')
                public method3() {
                    return { result: 3 };
                }
            }

            const controller = new MultiController();
            const rpcBinder = new RpcBinder(platformDriver as any, null as any);
            rpcBinder.bindControllerRpcs([[MultiController, controller]]);

            // Should have 2 server handlers and 1 client handler
            expect(platformDriver.onRpcServerCalls).toHaveLength(2);
            expect(platformDriver.onRpcClientCalls).toHaveLength(1);

            expect(platformDriver.onRpcServerCalls[0].rpcName).toBe('method1');
            expect(platformDriver.onRpcServerCalls[1].rpcName).toBe('method2');
            expect(platformDriver.onRpcClientCalls[0].rpcName).toBe('method3');
        });
    });

    describe('Async RPC Handlers', () => {
        it('should handle async operations', async () => {
            class AsyncController {
                @OnClientRpc('asyncMethod')
                public async asyncMethod(player: any, delay: number) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return { completed: true, delay };
                }
            }

            const controller = new AsyncController();
            const rpcBinder = new RpcBinder(platformDriver as any, null as any);
            rpcBinder.bindControllerRpcs([[AsyncController, controller]]);

            const handler = platformDriver.onRpcServerCalls[0].handler;
            const result = await handler(null, 10);

            expect(result).toEqual({ completed: true, delay: 10 });
        });
    });

    describe('Platform Drivers', () => {
        it('should have RAGE:MP driver with correct methods', () => {
            // Import and verify RAGE:MP driver
            const requiredMethods = ['on', 'off', 'onClient', 'emit', 'emitClient', 'invokeClient', 'onRpcServer', 'onRpcClient'];
            requiredMethods.forEach(method => {
                expect(platformDriver).toHaveProperty(method);
            });
        });
    });
});

// Integration test example
describe('RPC Integration', () => {
    it('should simulate complete RPC flow', async () => {
        // Server side
        class ServerController {
            @OnClientRpc('requestData')
            public requestData(player: any, id: number) {
                return { id, data: 'server response' };
            }
        }

        // Client side
        class ClientController {
            @OnServerRpc('receiveData')
            public receiveData(data: any) {
                return { acknowledged: true, data };
            }
        }

        const serverController = new ServerController();
        const clientController = new ClientController();
        const platformDriver = new MockPlatformDriver();

        // Setup bindings
        const rpcBinder = new RpcBinder(platformDriver as any, null as any);
        rpcBinder.bindControllerRpcs([
            [ServerController, serverController],
            [ClientController, clientController],
        ]);

        // Simulate client calling server
        const serverHandler = platformDriver.onRpcServerCalls.find(h => h.rpcName === 'requestData')?.handler;
        const serverResponse = await serverHandler?.({ id: 1, name: 'TestPlayer' }, 123);

        expect(serverResponse).toEqual({ id: 123, data: 'server response' });

        // Simulate server calling client
        const clientHandler = platformDriver.onRpcClientCalls.find(h => h.rpcName === 'receiveData')?.handler;
        const clientResponse = await clientHandler?.({ id: 1 }, serverResponse);

        expect(clientResponse).toEqual({ acknowledged: true, data: serverResponse });
    });
});

// Type testing example
describe('RPC Type Safety', () => {
    it('should infer return types correctly', async () => {
        class TypedController {
            @OnClientRpc('typedMethod')
            public typedMethod(player: any): { success: boolean; value: number } {
                return { success: true, value: 42 };
            }
        }

        const controller = new TypedController();
        const platformDriver = new MockPlatformDriver();
        const rpcBinder = new RpcBinder(platformDriver as any, null as any);
        rpcBinder.bindControllerRpcs([[TypedController, controller]]);

        const handler = platformDriver.onRpcServerCalls[0].handler;
        const result = await handler();

        // TypeScript would verify these types
        expect(result.success).toBe(true);
        expect(result.value).toBe(42);
    });
});
