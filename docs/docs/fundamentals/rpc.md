---
title: RPC
sidebar_label: RPC
---

RPCs are request/response calls between two sides of your gamemode: server to client, client to server, and either side to a WebView. Unlike events (which are fire-and-forget), an RPC returns a value, propagates errors, and enforces a timeout.

Aurora Framework exposes two ends of the same pipeline:

- **Handler decorators** (`@OnClientRpc`, `@OnServerRpc`, `@OnWebViewRpc`) register a method that answers an RPC.
- **`RpcService`** (server, client) invokes an RPC on the other side and awaits the result.

Every RPC goes through the platform driver's `RpcFacade`, which wraps calls with a timeout, an `AbortSignal`, and a normalised error.

## Handler decorators

Only **one** RPC (or event) decorator is allowed per method.

### Server side

| Decorator                            | Answers                                          |
| ------------------------------------ | ------------------------------------------------ |
| `@OnClientRpc(name?)`                | An RPC coming from a client.                     |
| `@OnWebViewRpc(webviewId, name?)`    | An RPC coming from a specific WebView (routed through the client). |

### Client side

| Decorator                            | Answers                                          |
| ------------------------------------ | ------------------------------------------------ |
| `@OnServerRpc(name?)`                | An RPC coming from the server.                   |
| `@OnWebViewRpc(webviewId, name?)`    | An RPC coming from the local WebView.            |

If you omit `name`, the method name is used as the RPC name.

## Writing a handler

Handlers are ordinary controller methods. Return a value (or a `Promise` of one) and Aurora sends it back to the caller.

```ts title="src/inventory/inventory.controller.ts"
import { Controller, Inject } from '@aurora-mp/core';
import { OnClientRpc } from '@aurora-mp/server';
import { InventoryService } from './inventory.service';

@Controller()
export class InventoryController {
    constructor(private readonly inventory: InventoryService) {}

    @OnClientRpc('inventory:get')
    public async getInventory(player: unknown): Promise<Item[]> {
        return this.inventory.load(player);
    }
}
```

The first argument to a server-side client RPC handler is always the player who invoked it. On client-side server RPC handlers there is no player argument, the driver only forwards the payload.

Parameter decorators (`@Player`, `@Payload`, `@Param`) work here exactly like they do for events.

## Invoking an RPC

Inject `RpcService` into any controller or provider. The service is registered globally by `ServerModule` / `ClientModule`, so no imports are needed.

### From the server to a client

```ts
import { Controller, Inject } from '@aurora-mp/core';
import { OnClient } from '@aurora-mp/server';
import { RpcService, RPC_SERVICE } from '@aurora-mp/core';

@Controller()
export class HudController {
    constructor(@Inject(RPC_SERVICE) private readonly rpc: RpcService) {}

    @OnClient('hud:ping')
    public async ping(player: unknown) {
        const version = await this.rpc.invokeClient<string>(player, 'hud:version');
        return { version };
    }
}
```

`invokeClient<T>(player, method, ...args)` returns `Promise<T>`.

### From the client to the server

```ts
import { Controller, Inject, RPC_SERVICE } from '@aurora-mp/core';
import type { RpcService } from '@aurora-mp/client';

@Controller()
export class MoneyController {
    constructor(@Inject(RPC_SERVICE) private readonly rpc: RpcService) {}

    public async requestBalance(): Promise<number> {
        return this.rpc.invokeServer<number>('money:balance');
    }
}
```

`invokeServer<T>(method, ...args)` returns `Promise<T>`.

### To a WebView

From the server, calls hop through the client owning the view:

```ts
await this.rpc.invokeWebview<{ ok: boolean }>(player, 'hud', 'toast:show', { text: 'Welcome' });
```

`invokeWebview<T>(player, webviewId, method, ...args)` returns `Promise<T>`. Under the hood it routes through the client via an `INVOKE_WEBVIEW_RPC` event; the client's `WebviewService` dispatches the call to the right view.

## Errors

Every failure raised by an RPC comes back as an `RpcError` with a stable `code` field.

| Code                | When it fires                                                         |
| ------------------- | --------------------------------------------------------------------- |
| `RPC_TIMEOUT`       | The call did not complete within the driver's timeout (default 10s).  |
| `RPC_DISPOSED`      | The driver was disposed while the RPC was in flight.                  |
| `RPC_BAD_TARGET`    | The target player id was invalid at dispatch time.                    |
| `RPC_CLIENT_ERROR`  | The remote handler threw or rejected.                                 |
| `RPC_PLAYER_DROPPED`| The player disconnected while the RPC was in flight.                  |
| `RPC_DISPATCH_FAILED`| The platform failed to send the outbound envelope.                   |
| `RPC_ERROR`         | Anything else that couldn't be classified.                            |

Callers should catch `RpcError` and branch on `error.code`:

```ts
import { RpcError, RpcErrorCode } from '@aurora-mp/core';

try {
    await this.rpc.invokeClient(player, 'hud:version');
} catch (error) {
    if (error instanceof RpcError && error.code === RpcErrorCode.TIMEOUT) {
        this.logger.warn(`hud:version timed out for player ${player}`);
    } else {
        throw error;
    }
}
```

### Throwing from a handler

Inside an RPC handler, throw an `RpcError` when you want the message to reach the peer:

```ts
throw new RpcError('Not enough money', 'INSUFFICIENT_FUNDS');
```

Anything else you throw (a plain `Error`, an unexpected exception) is replaced with the driver's `genericErrorMessage` before being sent back, so internal details never leak to untrusted peers.

## Timeouts

The default timeout is **10 seconds**, applied by the driver's `RpcFacade`. Timed-out calls reject with `RpcError` and `code === RPC_TIMEOUT`. You can change the timeout by configuring the driver when you boot the app (see the driver's factory options, e.g. `createFiveMApplication(AppModule, { rpc: { timeoutMs: 30_000 } })`).

## Cancellation

The facade wires an `AbortSignal` into every outbound RPC. When a player disconnects mid-call every in-flight RPC targeting that player is aborted with `RpcError` / `RPC_PLAYER_DROPPED`. When the driver itself is disposed (resource stop, hot reload) everything in flight aborts with `RPC_DISPOSED`.

You don't need to plumb signals yourself. Just `await` the promise and handle the rejection.

## RPC vs event: choosing

- Use an **event** (`@OnClient` / `@OnServer` / `@OnWebView` + `emit*`) when you're pushing a fact that doesn't need a reply, or when you want to broadcast to many listeners.
- Use an **RPC** (`@OnClientRpc` / `@OnServerRpc` / `@OnWebViewRpc` + `invoke*`) when you need a value back, want the caller to see errors, or want a timeout enforced by the framework.

## Next steps

- See how RPC handlers are wired inside controllers in [Controllers & events](./controllers).
- Reference: [`RpcService`](/api/server/classes/RpcService), [`RpcError`](/api/core/classes/RpcError), [`RpcErrorCode`](/api/core/type-aliases/RpcErrorCode).
