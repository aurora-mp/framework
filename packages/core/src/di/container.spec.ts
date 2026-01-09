import { DuplicateProviderError, ProviderNotFoundError } from '../errors';
import { Container, ProviderMetadata } from '../di';

describe('Container', () => {
    let container: Container;

    beforeEach(() => {
        container = new Container();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('register / resolve', () => {
        it('registers and resolves a value by string token', () => {
            container.register('TOKEN', 123);
            expect(container.resolve<number>('TOKEN')).toBe(123);
            expect(container.has('TOKEN')).toBe(true);
        });

        it('registers and resolves a value by symbol token', () => {
            const TOKEN = Symbol('MY_TOKEN');
            container.register(TOKEN, { ok: true });
            expect(container.resolve<{ ok: boolean }>(TOKEN)).toEqual({ ok: true });
        });

        it('registers and resolves by class constructor token', () => {
            class Service {
                public value = 'hello';
            }
            const instance = new Service();
            container.register(Service, instance);

            const resolved = container.resolve<Service>(Service);
            expect(resolved).toBe(instance);
            expect(resolved.value).toBe('hello');
        });

        it('supports registering undefined as a valid provider value', () => {
            container.register('UNDEF', undefined);

            expect(container.has('UNDEF')).toBe(true);
            expect(container.resolve('UNDEF')).toBeUndefined();
            expect(container.tryResolve('UNDEF')).toBeUndefined();
        });

        it('supports registering null as a valid provider value', () => {
            container.register('NULL', null);
            expect(container.resolve('NULL')).toBeNull();
        });

        it('throws ProviderNotFoundError when resolving unknown token', () => {
            expect(() => container.resolve('MISSING')).toThrow(ProviderNotFoundError);
            expect(() => container.resolve('MISSING')).toThrow(/not found/i);
            expect(() => container.resolve('MISSING')).toThrow(/MISSING/);
        });

        it('error message contains available tokens (when any exists)', () => {
            container.register('A', 1);
            container.register('B', 2);

            try {
                container.resolve('MISSING');
                throw new Error('Expected resolve to throw');
            } catch (e) {
                expect(e).toBeInstanceOf(ProviderNotFoundError);
                const msg = (e as Error).message;

                expect(msg).toMatch(/Available\s*:/);
                expect(msg).toContain('A');
                expect(msg).toContain('B');
            }
        });

        it('error message shows "none" when container is empty', () => {
            try {
                container.resolve('MISSING');
                throw new Error('Expected resolve to throw');
            } catch (e) {
                expect(e).toBeInstanceOf(ProviderNotFoundError);
                expect((e as Error).message).toMatch(/Available\s*:\s*none/);
            }
        });

        it('limits available tokens list in error message and adds ellipsis when > limit', () => {
            for (let i = 0; i < 12; i++) container.register(`T${i}`, i);

            try {
                container.resolve('MISSING');
                throw new Error('Expected resolve to throw');
            } catch (e) {
                expect((e as Error).message).toContain(', ...');
            }
        });
    });

    describe('override behavior', () => {
        it('overrides existing provider by default (allowOverride=true)', () => {
            container.register('TOKEN', 'v1');
            container.register('TOKEN', 'v2');
            expect(container.resolve('TOKEN')).toBe('v2');
        });

        it('throws DuplicateProviderError when allowOverride=false and token exists', () => {
            container.register('TOKEN', 'v1');

            expect(() => container.register('TOKEN', 'v2', { allowOverride: false })).toThrow(DuplicateProviderError);

            // Original value preserved
            expect(container.resolve('TOKEN')).toBe('v1');
        });

        it('does not throw when allowOverride=false and token does not exist', () => {
            expect(() => container.register('TOKEN', 'v1', { allowOverride: false })).not.toThrow();
        });
    });

    describe('tryResolve', () => {
        it('returns undefined when token not found', () => {
            expect(container.tryResolve('MISSING')).toBeUndefined();
        });

        it('returns the value when found', () => {
            container.register('TOKEN', 42);
            expect(container.tryResolve<number>('TOKEN')).toBe(42);
        });
    });

    describe('metadata', () => {
        it('stores metadata on first register (default scope=singleton)', () => {
            container.register('TOKEN', 1);

            const meta = container.getMetadata('TOKEN') as ProviderMetadata | undefined;
            expect(meta).toBeDefined();
            expect(meta?.scope).toBe('singleton');
            expect(meta?.overrides).toBe(0);
        });

        it('stores provided scope', () => {
            container.register('TOKEN', 1, { scope: 'transient' });
            expect(container.getMetadata('TOKEN')?.scope).toBe('transient');
        });

        it('preserves previous scope if overriding without explicit scope', () => {
            container.register('TOKEN', 1, { scope: 'transient' });
            container.register('TOKEN', 2); // no scope provided => keep transient

            const meta = container.getMetadata('TOKEN')!;
            expect(meta.scope).toBe('transient');
            expect(meta.overrides).toBeGreaterThanOrEqual(1);
        });

        it('returns undefined metadata when token is not registered', () => {
            expect(container.getMetadata('MISSING')).toBeUndefined();
        });
    });

    describe('getInstances / getTokens', () => {
        it('getInstances() returns all registered values (in insertion order)', () => {
            container.register('A', 1);
            container.register('B', 2);
            container.register('C', 3);

            expect(Array.from(container.getInstances())).toEqual([1, 2, 3]);
        });

        it('getTokens() returns all registered tokens (in insertion order)', () => {
            const S = Symbol('S');
            class X {}

            container.register('A', 1);
            container.register(S, 2);
            container.register(X, new X());

            const tokens = Array.from(container.getTokens());
            expect(tokens[0]).toBe('A');
            expect(tokens[1]).toBe(S);
            expect(tokens[2]).toBe(X);
        });
    });

    describe('remove / clear', () => {
        it('remove() returns false if token did not exist', () => {
            expect(container.remove('MISSING')).toBe(false);
        });

        it('remove() removes provider and metadata', () => {
            container.register('TOKEN', 1);

            expect(container.remove('TOKEN')).toBe(true);
            expect(container.has('TOKEN')).toBe(false);
            expect(container.getMetadata('TOKEN')).toBeUndefined();
            expect(() => container.resolve('TOKEN')).toThrow(ProviderNotFoundError);
        });

        it('clear() removes all providers and metadata', () => {
            container.register('A', 1);
            container.register('B', 2);

            container.clear();

            expect(container.has('A')).toBe(false);
            expect(container.has('B')).toBe(false);
            expect(container.getMetadata('A')).toBeUndefined();
            expect(container.getMetadata('B')).toBeUndefined();
            expect(Array.from(container.getInstances())).toHaveLength(0);
        });
    });

    describe('snapshot', () => {
        it('snapshot() returns providerCount and token strings', () => {
            const S = Symbol('SNAP');
            class SnapService {}

            container.register('A', 1);
            container.register(S, 2);
            container.register(SnapService, new SnapService());

            const snap = container.snapshot();
            expect(snap.providerCount).toBe(3);
            expect(snap.tokens).toEqual(expect.arrayContaining(['A', 'Symbol(SNAP)', 'SnapService']));
        });

        it('snapshot() respects maxTokens', () => {
            for (let i = 0; i < 30; i++) container.register(`T${i}`, i);

            const snap = container.snapshot(10);
            expect(snap.providerCount).toBe(30);
            expect(snap.tokens).toHaveLength(10);
        });
    });
});
