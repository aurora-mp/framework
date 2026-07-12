---
title: Controllers & events
sidebar_label: Controllers & events
---

Controllers are the classes where your gameplay code lives. They react to what happens on the platform (a player joining, a client emitting an event, a webview posting a message) and dispatch the work to your services.

Every controller is a plain class decorated with `@Controller()`, registered in a module's `controllers` array, and instantiated by the DI container.

```ts
import { Controller } from '@aurora-mp/core';

@Controller()
export class PlayerController {}
```

Aurora Framework then walks the class, finds every method decorated with an event decorator, and binds it to the platform driver at boot time.

## Event decorators

Method decorators tell Aurora which platform channel a handler listens on. Only **one** event decorator is allowed per method (a second one throws at load time).

### Cross-cutting

| Decorator          | Source                                |
| ------------------ | ------------------------------------- |
| `@On(name?)`       | General platform event, regardless of origin. |

If you omit `name`, the method name is used as the event name.

### Server side

| Decorator                              | Source                                                       |
| -------------------------------------- | ------------------------------------------------------------ |
| `@OnClient(name?)`                     | Event emitted by a client (`mp.events.callRemote` / `TriggerServerEvent`). |
| `@OnWebView(webviewId, name?)`         | Event coming from a specific WebView, forwarded by the client. |

### Client side

| Decorator                              | Source                                                       |
| -------------------------------------- | ------------------------------------------------------------ |
| `@OnServer(name?)`                     | Event emitted by the server for this client.                 |
| `@OnWebView(webviewId, name?)`         | Event posted by the local WebView.                           |

## Parameter decorators

Once a method is bound to an event, parameter decorators tell Aurora what to inject at call time. They live in `@aurora-mp/core` and work identically on server and client.

| Decorator              | Injects                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `@Player()`            | The player object attached to the event, if the platform provides one.                            |
| `@Player('name')`      | A single property off the player (`player.name` here).                                            |
| `@Payload()`           | The full event payload (typically the first meaningful argument).                                 |
| `@Payload('amount')`   | A single key off the payload object.                                                              |
| `@Param('amount')`     | Alias for `@Payload('amount')`. Convenient for named fields.                                      |
| `@Source()`            | Returns the raw source of the event (player ID, client ID, etc.) as provided by the platform driver. Useful for low-level operations like `mp.players.at(source)` or `GetPlayerName(source)`. It's mostly implemented for the fivem driver, but rage driver supports it too.

Any parameter without a decorator receives the raw event arguments in the order the driver delivered them.

## A full example

```ts title="src/player/player.controller.ts"
import { Controller, Inject, LOGGER_SERVICE, Player, Payload, type ILogger } from '@aurora-mp/core';
import { OnClient } from '@aurora-mp/server';

interface TransferPayload {
    amount: number;
    to: number;
}

@Controller()
export class PlayerController {
    constructor(@Inject(LOGGER_SERVICE) private readonly logger: ILogger) {}

    @OnClient('money:transfer')
    public onTransfer(
        @Player() player: unknown,
        @Payload() payload: TransferPayload,
    ) {
        this.logger.info(`transfer amount=${payload.amount} to=${payload.to}`);
    }
}
```

Register it in a module and you're done:

```ts title="src/player/player.module.ts"
import { Module } from '@aurora-mp/core';
import { PlayerController } from './player.controller';

@Module({
    controllers: [PlayerController],
})
export class PlayerModule {}
```

## Naming events

The `name` argument on every event decorator is optional. When present, it becomes the wire-level event name the platform driver listens on. When absent, the method name is used verbatim.

```ts
@OnClient()                        // listens for the event named "onTransfer"
public onTransfer() {}

@OnClient('money:transfer')        // listens for "money:transfer"
public onTransfer() {}
```

Prefer explicit names for anything you emit from the other side. It removes the coupling between method renames and wire compatibility.

## WebView events

`@OnWebView` is the same shape on both sides, with an extra `webviewId` that scopes the subscription to a single view. This is what lets you multiplex multiple views (HUD, menu, chat) over the same event channel.

```ts
@Controller()
export class HudController {
    @OnWebView('hud', 'ready')
    public onHudReady() {}
}
```

The corresponding webview posts with the same id, and Aurora routes it to the right handler.

## Guards

If you want to run authorisation logic before the handler fires, decorate the method (or the whole controller) with `@UseGuards(...)`. See [Guards](./guards).

## Next steps

- Learn how RPCs return values across the wire in [RPC](./rpc).
- See how controllers and services are wired together in [Providers & DI](./providers).
- Full decorator API: [Core reference](/api/core).
