import { ClassProvider, FactoryProvider, Provider, Type, ValueProvider } from '../types';
import { Scope } from '../enums';
import { INJECTABLE_SCOPE_OPTIONS } from '../constants';

/**
 * Union of all normalized providers: guarantees the presence of `provide`.
 */
export type NormalizedProvider<T = unknown> = ClassProvider<T> | ValueProvider<T> | FactoryProvider<T>;

/**
 * Takes either:
 *  - a raw `Type<T>` (class constructor), or
 *  - a `Provider<T>` object (with useClass/useValue/useFactory)
 * and returns a `NormalizedProvider<T>` that always has a `provide` property.
 */
export function normalizeProvider<T = unknown>(provider: Provider<T> | Type<T>): NormalizedProvider<T> {
    // 1) If a class constructor is passed directly, wrap it as a ClassProvider
    if (typeof provider === 'function') {
        return { provide: provider, useClass: provider };
    }

    // 2) If it has a factory function, build a FactoryProvider
    if ('useFactory' in provider && provider.useFactory) {
        const fp: FactoryProvider<T> = {
            provide: provider.provide,
            useFactory: provider.useFactory,
            inject: provider.inject ?? [],
        };
        if (provider.scope !== undefined) {
            fp.scope = provider.scope;
        }
        return fp;
    }

    // 3) If it has a static value, build a ValueProvider
    if ('useValue' in provider && provider.useValue !== undefined) {
        const vp: ValueProvider<T> = {
            provide: provider.provide,
            useValue: provider.useValue,
        };
        if (provider.scope !== undefined) {
            vp.scope = provider.scope;
        }
        return vp;
    }

    // 4) If a useClass is explicitly declared, build a ClassProvider
    if ('useClass' in provider && provider.useClass) {
        const cp: ClassProvider<T> = {
            provide: provider.provide,
            useClass: provider.useClass,
        };
        if (provider.scope !== undefined) {
            cp.scope = provider.scope;
        }
        return cp;
    }

    throw new Error(`[Aurora] Invalid provider configuration for token "${String((provider as any).provide)}"`);
}

/**
 * Determines the injection scope (Singleton or Transient):
 *  - Factory providers default to SINGLETON.
 *  - Class and value providers inherit the scope metadata from @Injectable.
 */
export function getProviderScope(provider: Provider<unknown> | Type<unknown>): Scope {
    const norm = normalizeProvider(provider as any);

    // Factory providers: return their own scope or default to SINGLETON
    if ('useFactory' in norm) {
        return norm.scope ?? Scope.SINGLETON;
    }

    // Class or value providers: read the metadata from the constructor
    let ctor: Function | undefined;
    if ('useClass' in norm) {
        ctor = norm.useClass;
    } else if ('useValue' in norm) {
        ctor = (norm.useValue as any).constructor;
    }

    if (ctor) {
        const meta = Reflect.getMetadata(INJECTABLE_SCOPE_OPTIONS, ctor) as Scope;
        return meta ?? Scope.SINGLETON;
    }

    // Fallback to SINGLETON
    return Scope.SINGLETON;
}
