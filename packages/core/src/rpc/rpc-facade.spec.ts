import { RpcError } from '../errors/rpc-error';
import { RpcErrorCode } from './rpc-codes';
import { RpcFacade } from './rpc-facade';

describe('RpcFacade', () => {
    describe('invoke — success path', () => {
        it('resolves with the value produced by send()', async () => {
            const facade = new RpcFacade();
            const result = await facade.invoke<number>({
                rpcName: 'add',
                player: 1,
                send: async () => 42,
            });
            expect(result).toBe(42);
        });

        it('passes an AbortSignal to send()', async () => {
            const facade = new RpcFacade();
            let received: AbortSignal | undefined;
            await facade.invoke({
                rpcName: 'ping',
                player: 1,
                send: async (signal) => {
                    received = signal;
                    return 'ok';
                },
            });
            expect(received).toBeInstanceOf(AbortSignal);
        });
    });

    describe('invoke — timeout', () => {
        it('rejects with RPC_TIMEOUT when send() does not resolve in time', async () => {
            const facade = new RpcFacade({ timeoutMs: 20 });
            let capturedSignal: AbortSignal | undefined;
            const promise = facade.invoke({
                rpcName: 'slow',
                player: 1,
                send: (signal) =>
                    new Promise((_, reject) => {
                        capturedSignal = signal;
                        signal.addEventListener('abort', () => reject(signal.reason));
                    }),
            });

            await expect(promise).rejects.toBeInstanceOf(RpcError);
            await expect(promise).rejects.toMatchObject({ code: RpcErrorCode.TIMEOUT });
            expect(capturedSignal?.aborted).toBe(true);
        });
    });

    describe('cancelPlayer', () => {
        it('rejects in-flight invocations with RPC_PLAYER_DROPPED', async () => {
            const facade = new RpcFacade();
            const promise = facade.invoke({
                rpcName: 'wait',
                player: 42,
                send: (signal) =>
                    new Promise((_, reject) => {
                        signal.addEventListener('abort', () => reject(signal.reason));
                    }),
            });

            // Yield so invoke's synchronous prelude has time to register the
            // AbortController before we cancel.
            await Promise.resolve();
            facade.cancelPlayer(42);

            await expect(promise).rejects.toMatchObject({ code: RpcErrorCode.PLAYER_DROPPED });
        });

        it('does not affect invocations for other players', async () => {
            const facade = new RpcFacade();
            const staySettled = facade.invoke({
                rpcName: 'ok',
                player: 7,
                send: async () => 'done',
            });

            facade.cancelPlayer(42);
            await expect(staySettled).resolves.toBe('done');
        });
    });

    describe('dispose', () => {
        it('cancels every in-flight invocation with RPC_DISPOSED', async () => {
            const facade = new RpcFacade();
            const promise = facade.invoke({
                rpcName: 'shutdown-me',
                player: 3,
                send: (signal) =>
                    new Promise((_, reject) => {
                        signal.addEventListener('abort', () => reject(signal.reason));
                    }),
            });

            await Promise.resolve();
            facade.dispose();

            await expect(promise).rejects.toMatchObject({ code: RpcErrorCode.DISPOSED });
        });

        it('rejects synchronously for new invocations after dispose', async () => {
            const facade = new RpcFacade();
            facade.dispose();
            await expect(
                facade.invoke({ rpcName: 'x', player: 1, send: async () => 'y' }),
            ).rejects.toMatchObject({ code: RpcErrorCode.DISPOSED });
        });
    });

    describe('wrapHandler', () => {
        it('returns { result } for successful handlers', async () => {
            const facade = new RpcFacade();
            const wrapped = facade.wrapHandler('echo', async (msg: string) => msg.toUpperCase());
            await expect(wrapped('hi')).resolves.toEqual({ result: 'HI' });
        });

        it('converts thrown Error into { error: genericErrorMessage }', async () => {
            const facade = new RpcFacade({ genericErrorMessage: 'boom' });
            const wrapped = facade.wrapHandler('fail', () => {
                throw new Error('secret internal detail');
            });
            const out = await wrapped();
            expect(out).toEqual({ error: 'boom' });
        });

        it('forwards RpcError messages verbatim (public error surface)', async () => {
            const facade = new RpcFacade({ genericErrorMessage: 'boom' });
            const wrapped = facade.wrapHandler('fail', () => {
                throw new RpcError('missing input', RpcErrorCode.BAD_TARGET);
            });
            await expect(wrapped()).resolves.toEqual({ error: 'missing input' });
        });

        it('converts synchronous throws into promise rejections without hanging', async () => {
            const facade = new RpcFacade();
            const wrapped = facade.wrapHandler('sync-throw', () => {
                throw new Error('sync');
            });
            // If the facade did not wrap this, a sync throw would propagate
            // and the client would hang waiting on its own timeout.
            const out = await wrapped();
            expect(out).toHaveProperty('error');
        });

        it('reports errors through onError hook', async () => {
            const onError = jest.fn();
            const facade = new RpcFacade({ onError });
            const wrapped = facade.wrapHandler('err', () => {
                throw new Error('nope');
            });
            await wrapped();
            expect(onError).toHaveBeenCalledTimes(1);
            expect(onError.mock.calls[0][1]).toMatchObject({ rpcName: 'err' });
        });
    });
});
