---
title: Lifecycle hooks
sidebar_label: Lifecycle hooks
---

Aurora Framework raises three lifecycle hooks as the application boots and shuts down. Implement the matching interface on any controller or provider and the container will call your method at the right moment.

| Interface        | Method                              | Fires                                           |
| ---------------- | ----------------------------------- | ----------------------------------------------- |
| `OnAppInit`      | `onAppInit(): void \| Promise<void>` | After every module is scanned and every provider/controller is instantiated, before event/RPC binding. |
| `OnAppStarted`   | `onAppStarted(): void \| Promise<void>` | After events and RPCs are bound to the platform driver, and after plugin `onBootstrap` runs. |
| `OnAppShutdown`  | `onAppShutdown(signal?): void \| Promise<void>` | When `app.close(signal?)` is called. On FiveM this fires automatically on `onResourceStop`. |

All three signatures may return a `Promise`. The framework awaits each hook, so async setup and teardown work as you'd expect.

## Boot timeline

```
createRageApplication / createFiveMApplication
        │
        ▼
   scan modules
        │
        ▼
   instantiate providers + controllers
        │
        ▼
   ── onAppInit  ────────────  hooks run here
        │
        ▼
   bind events + RPCs to the driver
        │
        ▼
   plugin onBootstrap
        │
        ▼
   ── onAppStarted  ─────────  hooks run here
        │
        ▼
   listening for events, RPCs, players
        │
        ▼
   app.close(signal)     (FiveM: fires on onResourceStop)
        │
        ▼
   ── onAppShutdown  ────────  hooks run here
```

## Implementing a hook

Implement the interface, add the method, and register the class as a controller or provider in some module. Everything else is automatic.

```ts title="src/database/database.service.ts"
import { Injectable, type OnAppInit, type OnAppShutdown } from '@aurora-mp/core';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnAppInit, OnAppShutdown {
    private pool!: Pool;

    public async onAppInit(): Promise<void> {
        this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
        await this.pool.query('SELECT 1');
    }

    public async onAppShutdown(signal?: string): Promise<void> {
        await this.pool.end();
    }
}
```

Register it in a module (or export it from a `@Global()` module) and Aurora will call `onAppInit` during boot and `onAppShutdown` on close.

## Choosing between `onAppInit` and `onAppStarted`

Both run once at boot. The difference is what's already wired when your hook fires.

- **`onAppInit`** runs before any handler is bound to the driver. This is the right place for **preparation work**: opening database pools, warming caches, reading configuration, seeding registries. Nothing on the platform can call you yet, which means you can safely block boot until you're ready.
- **`onAppStarted`** runs after every `@On*` and `@On*Rpc` handler is registered with the driver. Use it when you need to **emit** something the moment the app is live: announcing readiness, pushing a state snapshot to connected clients, kicking off a warm-up broadcast.

Rule of thumb: if you're about to *emit*, use `onAppStarted`. If you're about to *load*, use `onAppInit`.

## Shutdown and the `signal` argument

`onAppShutdown(signal?)` receives whatever string the caller passed to `app.close(signal?)`. On the FiveM driver the framework closes the app automatically when the resource stops, forwarding the string `'onResourceStop'`.

```ts
@Injectable()
export class MetricsService implements OnAppShutdown {
    public async onAppShutdown(signal?: string): Promise<void> {
        await this.flush({ reason: signal ?? 'unknown' });
    }
}
```

On drivers that don't wire up an automatic close, you're responsible for calling `app.close(...)` yourself (typically inside your own process/signal handler).

## Controllers vs providers

Both are eligible. Aurora walks the module graph and calls each hook once per **instance** (deduplicated by identity), so:

- A controller can implement any of the three interfaces the same way a provider does.
- If a provider is imported into multiple modules, its hook still fires only once.
- Order follows module scan order (imports first, root last).

```ts
@Controller()
export class MetricsController implements OnAppStarted {
    public onAppStarted(): void {
        // start reporting the moment the driver is bound
    }
}
```

## Async hooks and boot ordering

The framework `await`s every hook. That means:

- A slow `onAppInit` on one provider **blocks boot** until it resolves. This is usually what you want (e.g. "don't accept requests until the DB is up").
- Hooks run **sequentially**, not in parallel. If you need parallelism, start your own `Promise.all` inside a single hook.

```ts
public async onAppInit(): Promise<void> {
    await Promise.all([
        this.warmCache(),
        this.connectDb(),
    ]);
}
```

## Next steps

- See how controllers and providers get wired up in [Providers & DI](./providers).
- Reference: [`OnAppInit`](/api/core/interfaces/OnAppInit), [`OnAppStarted`](/api/core/interfaces/OnAppStarted), [`OnAppShutdown`](/api/core/interfaces/OnAppShutdown).
