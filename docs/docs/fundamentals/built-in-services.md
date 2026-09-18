---
title: Built-in services
sidebar_label: Built-in services
---

Each driver comes with a set of pre-registered services in the DI container. You inject them by their **token**, not by class, because the underlying implementation depends on the platform you booted with.

All of these live inside `@Global()` modules, so you can `@Inject` them from any controller or provider without touching `imports`.

## The tokens

Tokens are `Symbol`s exported from `@aurora-mp/core`. Every one of them maps to an interface (also exported from core), so you inject the interface and let TypeScript type your dependency correctly.

| Token              | Interface        | What it does                                                                 |
| ------------------ | ---------------- | ---------------------------------------------------------------------------- |
| `PLATFORM_DRIVER`  | `IPlatformDriver`| The low-level driver (events, RPCs, webviews). Used internally by services.  |
| `LOGGER_SERVICE`   | `ILogger`        | Structured logger (`debug`/`info`/`warn`/`error`).                           |
| `CONFIG_LOADER`    | `IConfigLoader`  | Platform-specific loader that reads raw config off disk.                     |
| `CONFIG_SERVICE`   | `IConfigService` | Typed accessor built on top of `CONFIG_LOADER` (`get<T>(key, default?)`).    |
| `EVENT_SERVICE`    | `EventService`   | Emits events through the driver (global, targeted, webview).                 |
| `RPC_SERVICE`      | `RpcService`     | Invokes RPCs (`invokeClient` / `invokeServer` / `invokeWebview`).            |
| `WEBVIEW_SERVICE`  | `WebviewService` | Creates and tracks in-game WebView instances.                                |

## Server side

### `ServerModule` (cross-platform)

Registered as soon as a server driver boots. You get these regardless of which platform you picked.

| Token             | Implementation   |
| ----------------- | ---------------- |
| `CONFIG_SERVICE`  | `ConfigService`  |
| `EVENT_SERVICE`   | `EventService`   |
| `RPC_SERVICE`     | `RpcService`     |

### RAGE MP server driver

Added on top of `ServerModule` when you boot with `createRageApplication`.

| Token              | Implementation                           |
| ------------------ | ---------------------------------------- |
| `PLATFORM_DRIVER`  | `RageServerDriver`                       |
| `LOGGER_SERVICE`   | `LoggerService` (winston-based)          |
| `CONFIG_LOADER`    | `RageConfigLoader` (reads `conf.json`)   |

### FiveM server driver

Added on top of `ServerModule` when you boot with `createFiveMApplication`.

| Token              | Implementation                                   |
| ------------------ | ------------------------------------------------ |
| `PLATFORM_DRIVER`  | `FiveMServerDriver`                              |
| `LOGGER_SERVICE`   | `LoggerService` (winston-based)                  |
| `CONFIG_LOADER`    | `ConfigLoader` (reads FiveM convars / env)       |

## Client side

### `ClientModule` (cross-platform)

Registered as soon as a client driver boots.

| Token             | Implementation                                    |
| ----------------- | ------------------------------------------------- |
| `EVENT_SERVICE`   | `EventService`                                    |
| `RPC_SERVICE`     | `RpcService`                                      |
| `WEBVIEW_SERVICE` | `WebviewService`                                  |

### RAGE MP client driver

| Token              | Implementation      |
| ------------------ | ------------------- |
| `PLATFORM_DRIVER`  | `RageClientDriver`  |
| `LOGGER_SERVICE`   | `LoggerService`     |

### FiveM client driver

| Token              | Implementation      |
| ------------------ | ------------------- |
| `PLATFORM_DRIVER`  | `FiveMClientDriver` |
| `LOGGER_SERVICE`   | `LoggerService`     |

## Injecting them

Use `@Inject(TOKEN)` in a constructor (or on a property) and type the field with the matching interface:

```ts
import { Controller, Inject, LOGGER_SERVICE, CONFIG_SERVICE, EVENT_SERVICE, type ILogger, type IConfigService } from '@aurora-mp/core';
import { OnClient } from '@aurora-mp/server';

@Controller()
export class WelcomeController {
    constructor(
        @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
        @Inject(CONFIG_SERVICE) private readonly config: IConfigService,
    ) {}

    @OnClient('player:hello')
    public onHello() {
        const name = this.config.get<string>('serverName', 'aurora-mp');
        this.logger.info(`hello from ${name}`);
    }
}
```

`EventService`, `RpcService`, `WebviewService` and `ConfigService` are classes, so you can also inject them by type without `@Inject` if you want. The token form is recommended when the type is an interface (`ILogger`, `IConfigService`, `IPlatformDriver`) since interfaces don't survive at runtime.

## Swapping an implementation

Because the framework binds each service to a **token**, you can override any of them from your own module. This is useful for tests, or for pointing `LOGGER_SERVICE` at your own transport:

```ts
import { Global, LOGGER_SERVICE, Module } from '@aurora-mp/core';
import { MyLogger } from './my-logger';

@Global()
@Module({
    providers: [
        { provide: LOGGER_SERVICE, useClass: MyLogger },
    ],
    exports: [LOGGER_SERVICE],
})
export class LoggingOverrideModule {}
```

Import `LoggingOverrideModule` in your `AppModule` and every consumer that asks for `LOGGER_SERVICE` gets your class instead.

## Next steps

- The mechanics of tokens and provider forms live in [Providers & DI](./providers).
- API reference for each service: [`EventService`](/api/server/classes/EventService), [`RpcService`](/api/server/classes/RpcService), [`ConfigService`](/api/server/classes/ConfigService), [`WebviewService`](/api/client/classes/WebviewService).
