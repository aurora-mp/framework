---
title: Modules
sidebar_label: Modules
---

Modules are how you organise an Aurora Framework application. Every controller and provider belongs to a module, and modules can import each other to compose larger features from smaller units.

The application always has a **root module** (the one you pass to `createRageApplication` / `createFiveMApplication`). Everything else is reachable from the root through the `imports` graph.

## Anatomy of a module

`@Module` accepts four optional fields. The framework rejects any other key at load time.

```ts
import { Module } from '@aurora-mp/core';

@Module({
    imports: [OtherModule],
    controllers: [MyController],
    providers: [MyService],
    exports: [MyService],
})
export class MyModule {}
```

| Field         | Type                     | Purpose                                                                                   |
| ------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `imports`     | `Type[]`                 | Other `@Module` classes whose exports become visible inside this module.                  |
| `controllers` | `Type[]`                 | Controllers instantiated at boot; their `@On*` / `@On*Rpc` handlers get bound.            |
| `providers`   | `Provider[]`             | Services and value bindings the container should resolve. See [Providers & DI](./providers). |
| `exports`     | `Token[]`                | Subset of provider tokens made available to modules that import this one.                 |

You never register a module more than once. Aurora deduplicates by class identity: importing the same module from two places gives you a single instance of its providers, not two.

## Encapsulation: providers are local by default

A provider registered in a module is only visible **inside that module**. Consumers in another module can't inject it unless the owning module explicitly exports the token.

```ts title="src/user/user.module.ts"
@Module({
    providers: [UserService, UserRepository],
    exports: [UserService], // only UserService is public
})
export class UserModule {}
```

```ts title="src/profile/profile.module.ts"
@Module({
    imports: [UserModule],
    controllers: [ProfileController], // may inject UserService
})
export class ProfileModule {}
```

`ProfileController` can inject `UserService` because `UserModule` exports it. It cannot inject `UserRepository` even though it lives in the same imported module. This is what keeps large gamemodes tidy: each module chooses what it publishes.

Controllers are always private. They live in their owning module and are never injected by name from outside.

## Composition patterns

### Feature modules

Group everything for one gameplay domain in one module: its controllers, its services, the interfaces it exposes to the rest of the app.

```
src/
  inventory/
    inventory.module.ts
    inventory.controller.ts
    inventory.service.ts
    inventory.repository.ts
```

```ts title="src/inventory/inventory.module.ts"
@Module({
    controllers: [InventoryController],
    providers: [InventoryService, InventoryRepository],
    exports: [InventoryService],
})
export class InventoryModule {}
```

The root module then just imports the feature modules it needs:

```ts title="src/app.module.ts"
@Module({
    imports: [InventoryModule, UserModule, HudModule],
})
export class AppModule {}
```

### Shared modules

If two feature modules both need the same service, put the service in a **shared module** and have both features import it. The provider stays a singleton (one instance shared across the graph) as long as its scope is `SINGLETON` (the default).

```ts title="src/shared/database.module.ts"
@Module({
    providers: [DatabaseService],
    exports: [DatabaseService],
})
export class DatabaseModule {}
```

```ts
@Module({ imports: [DatabaseModule], providers: [UserService] })
export class UserModule {}

@Module({ imports: [DatabaseModule], providers: [InventoryService] })
export class InventoryModule {}
```

Both features get the same `DatabaseService` instance.

## Global modules

For cross-cutting services (logging, config, database) it's noise to import a module into every feature. Decorate a module with `@Global()` and its **exports** become injectable everywhere without any `imports` entry.

```ts title="src/config/config.module.ts"
import { Global, Module } from '@aurora-mp/core';
import { ConfigService } from './config.service';

@Global()
@Module({
    providers: [ConfigService],
    exports: [ConfigService],
})
export class ConfigModule {}
```

You still need to import a `@Global()` module **once**, in the root module, so Aurora sees it during the module scan. After that its exports are available to every module in the graph.

`ServerModule`, `ClientModule`, and the platform modules use this mechanism internally. That's why `LOGGER_SERVICE`, `CONFIG_SERVICE`, `EVENT_SERVICE`, and friends are available in any controller without you importing anything. See [Built-in services](./built-in-services) for the full list.

Rule of thumb: use `@Global()` sparingly. Every `@Global()` module is a piece of hidden coupling. Feature modules should not be global; only genuinely cross-cutting infrastructure should.

## Circular imports

Aurora detects circular imports during the scan phase and throws:

```
[Aurora] Circular dependency detected in module imports: FooModule is part of a cycle.
```

If two modules genuinely need each other's exports, that's almost always a sign the shared code should move into a third module they both import. Break the cycle by extracting the common interface or service into a shared module.

## The root module

The root module is the class you hand to the platform factory:

```ts title="src/index.ts"
import 'reflect-metadata';
import { createFiveMApplication } from '@aurora-mp/platform-fivem-server';
import { AppModule } from './app.module';

await createFiveMApplication(AppModule);
```

Aurora wraps it in an internal module that also imports `ServerModule` (or `ClientModule`) and the platform's own `PlatformModule`. That's why your `AppModule` doesn't need to import them itself: `LOGGER_SERVICE`, `CONFIG_LOADER`, the platform driver, and the platform-agnostic services are already available.

## Boot order

At boot, Aurora walks your module graph depth-first from the root:

1. **Scan** every module reachable through `imports`. Detect cycles.
2. **Instantiate** every provider, then every controller, in module scan order (imports first, root last).
3. **Bind** events and RPC handlers on controllers to the platform driver.

Providers imported by many modules are instantiated once, on first resolve.

## Next steps

- Everything about providers, tokens, and scopes: [Providers & DI](./providers).
- What's already registered for you: [Built-in services](./built-in-services).
- Hooks that let providers react to boot/shutdown: [Lifecycle hooks](./lifecycle-hooks).
