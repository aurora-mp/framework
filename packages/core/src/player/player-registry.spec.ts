import { Container } from '../di/container';
import type { IPlatformDriver } from '../interfaces/platform-driver.interface';
import { PlayerComponentRegistry } from './component-registry';
import { PlayerEntity } from './player';
import { PlayerComponent, type IPlayerComponent } from './player-component';
import { PlayerExtenderRegistry, type PlayerExtender } from './player-extender';
import { PlayerRegistry } from './player-registry';

@PlayerComponent()
class ComponentA implements IPlayerComponent {
    public attached = false;
    public detached = false;
    public onAttach() {
        this.attached = true;
    }
    public onDetach() {
        this.detached = true;
    }
}

@PlayerComponent()
class ComponentB implements IPlayerComponent {
    public sawPeer = false;
    public onAttach(player: PlayerEntity) {
        this.sawPeer = player.has(ComponentA);
    }
}

function fakeDriver(): IPlatformDriver {
    return {
        on: () => undefined,
        emit: () => undefined,
        emitClient: () => undefined,
        invokeClient: <T>() => Promise.resolve(undefined as T),
    };
}

function makeRegistry() {
    const componentRegistry = new PlayerComponentRegistry();
    componentRegistry.register(ComponentA);
    componentRegistry.register(ComponentB);

    const extenderRegistry = new PlayerExtenderRegistry();
    extenderRegistry.configure({ container: new Container() });

    const factories: (() => unknown)[] = [() => new ComponentA(), () => new ComponentB()];
    let idx = 0;
    const componentFactory = async <T>(): Promise<T> => {
        const value = factories[idx++]!() as T;
        return value;
    };

    const registry = new PlayerRegistry();
    registry.configure({
        driver: fakeDriver(),
        componentRegistry,
        componentFactory,
        extenderRegistry,
    });

    return { registry, componentRegistry, extenderRegistry, resetFactories: () => (idx = 0) };
}

describe('PlayerRegistry', () => {
    it('memoises wrappers by source id', async () => {
        const { registry } = makeRegistry();
        const first = await registry.create(5);
        const second = await registry.create(5);
        expect(first).toBe(second);
    });

    it('attaches components in registration order and populates the map', async () => {
        const { registry, resetFactories } = makeRegistry();
        resetFactories();
        const player = await registry.create(1);
        expect(player.has(ComponentA)).toBe(true);
        expect(player.has(ComponentB)).toBe(true);
        expect(player.get(ComponentA).attached).toBe(true);
        // ComponentB observed ComponentA at attach time → confirms map is
        // populated in order rather than atomically at the end.
        expect(player.get(ComponentB).sawPeer).toBe(true);
    });

    it('runs component onDetach and evicts on destroy()', async () => {
        const { registry, resetFactories } = makeRegistry();
        resetFactories();
        const player = await registry.create(2);
        const a = player.get(ComponentA);
        await registry.destroy(2);
        expect(a.detached).toBe(true);
        expect(registry.get(2)).toBeUndefined();
    });

    it('runs extenders on attach and detach', async () => {
        const { registry, extenderRegistry, resetFactories } = makeRegistry();
        resetFactories();

        const events: string[] = [];
        const extender: PlayerExtender = {
            onAttach: () => {
                events.push('attach');
            },
            onDetach: () => {
                events.push('detach');
            },
        };
        extenderRegistry.register(extender);

        await registry.create(9);
        await registry.destroy(9);

        expect(events).toEqual(['attach', 'detach']);
    });

    it('invokes cancelPlayerRpcs on destroy so in-flight RPCs unblock', async () => {
        const componentRegistry = new PlayerComponentRegistry();
        const registry = new PlayerRegistry();
        const cancels: number[] = [];
        registry.configure({
            driver: fakeDriver(),
            componentRegistry,
            componentFactory: async () => ({}) as never,
            cancelPlayerRpcs: (source) => cancels.push(source),
        });
        await registry.create(11);
        await registry.destroy(11);
        expect(cancels).toEqual([11]);
    });

    it('destroy() is a no-op for unknown sources', async () => {
        const { registry } = makeRegistry();
        await expect(registry.destroy(999)).resolves.toBeUndefined();
    });
});
