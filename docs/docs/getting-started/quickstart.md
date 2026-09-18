---
title: Your first application
sidebar_label: Quickstart
---

This guide takes you from an empty aurora-mp project to a running server that logs when a player connects. The example uses the server side; the same shape applies on the client.

We assume you already have a project scaffolded via the [CLI](./installation#option-1-scaffold-with-the-cli-recommended) or the packages [installed manually](./installation#option-2-manual-install).

## 1. Create an `AppModule`

Every aurora-mp application starts from a **root module** decorated with `@Module`. Modules declare the controllers and providers the DI container should wire up.

```ts title="src/app.module.ts"
import { Module } from '@aurora-mp/core';
import { PlayerController } from './player.controller';

@Module({
    controllers: [PlayerController],
    providers: [],
})
export class AppModule {}
```

## 2. Add a controller

Controllers subscribe to platform events with method decorators. Parameter decorators tell aurora-mp what to inject at call time. Here we grab the player and the raw payload.

```ts title="src/player.controller.ts"
import { Controller, Inject, LOGGER_SERVICE, type ILogger } from '@aurora-mp/core';
import { OnClient } from '@aurora-mp/server';
import { Player, Payload } from '@aurora-mp/core';

@Controller()
export class PlayerController {
    constructor(@Inject(LOGGER_SERVICE) private readonly logger: ILogger) {}

    @OnClient('player:hello')
    public onHello(@Player() player: unknown, @Payload() message: string) {
        this.logger.info(`[hello] player=${JSON.stringify(player)} message=${message}`);
    }
}
```

The event name (`'player:hello'`) is what the client emits with `mp.events.callRemote` (RAGE MP) or `TriggerServerEvent` (FiveM).

## 3. Boot the application

Pick the factory that matches the platform you installed. Both wrap `AppModule` in an internal module that also imports `ServerModule` and the platform driver, so you don't have to.

### RAGE MP

```ts title="src/index.ts"
import 'reflect-metadata';
import { createRageApplication } from '@aurora-mp/platform-ragemp-server';
import { AppModule } from './app.module';

createRageApplication(AppModule);
```

### FiveM

```ts title="src/index.ts"
import 'reflect-metadata';
import { createFiveMApplication } from '@aurora-mp/platform-fivem-server';
import { AppModule } from './app.module';

await createFiveMApplication(AppModule);
```

## 4. Run it

Build your resource and boot your platform's server:

```bash
pnpm run build
# then start your RAGE MP / FiveM server as usual
```

You should see aurora-mp's Winston logger initialise, the module graph resolve, and (once a client fires `player:hello`) a log line from `PlayerController.onHello`.

## What just happened?

- **`AppModule`** registered `PlayerController` with the DI container.
- The **platform driver** (`RageServerDriver` / `FiveMServerDriver`) translated the platform's raw event into a call routed by aurora-mp's event binder.
- **Parameter decorators** (`@Player`, `@Payload`) resolved the values before your method ran.
- **`@Inject(LOGGER_SERVICE)`** pulled the framework logger out of the container, the same one aurora-mp uses internally.

## Next steps

- Learn how the DI container wires everything up in [Providers & DI](../fundamentals/providers).
- Explore the full API in the [Core reference](/api/core).
