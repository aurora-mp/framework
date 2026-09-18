---
title: WebViews overview
sidebar_label: Overview
---

A **WebView** in Aurora Framework is a browser instance rendered on top of the game (HUD, menus, chat, dev tools). What makes them useful is that a single API surface lets your server, your client, and your browser code all talk to each other with the same events + RPC vocabulary you already use elsewhere.

## Three sides, one channel

Every WebView spans three runtimes. Each side has its own package and its own `WebviewService`.

```
┌────────────────┐     events / RPC      ┌────────────────┐    events / RPC     ┌───────────────┐
│  Server        │  ───────────────────► │  Client        │  ─────────────────► │  Browser      │
│  @aurora-mp/   │                       │  @aurora-mp/   │                     │  @aurora-mp/  │
│  server        │  ◄─────────────────── │  client        │  ◄───────────────── │  webview      │
└────────────────┘                       └────────────────┘                     └───────────────┘
```

| Side       | Package                | Role                                                                 |
| ---------- | ---------------------- | -------------------------------------------------------------------- |
| Server     | `@aurora-mp/server`    | Emits events / invokes RPCs at a WebView owned by a specific player. |
| Client     | `@aurora-mp/client`    | Creates and destroys WebView instances; routes traffic in both directions. |
| Browser    | `@aurora-mp/webview`   | Runs inside the WebView bundle. Subscribes to events and answers RPCs. |

The client is always the bridge. Server-to-webview messages hop through the client that owns the view; the browser-to-server messages hop the other way.

## The three services

Each side gets a service with a similar shape but a different transport.

| Service                       | Where it runs                        | Injection                              |
| ----------------------------- | ------------------------------------ | -------------------------------------- |
| `WebviewService` (client)     | Client controllers and providers.    | Injected via `WEBVIEW_SERVICE` token.  |
| `EventService` / `RpcService` | Server controllers and providers.    | Injected via `EVENT_SERVICE` / `RPC_SERVICE`. Server code uses these to reach webviews. |
| `WebviewService` (browser)    | Inside the WebView bundle itself.    | Imported directly, no DI container.    |

## The browser-side entry point

The browser bundle is a plain TypeScript project (React, Vue, plain HTML, whatever you like). Aurora ships a small helper that talks to the game runtime:

```ts title="src/webview/hud/index.ts"
import { aurora } from '@aurora-mp/webview';

// Listen for events from the client
aurora.on('hud:score', (score: number) => {
    document.getElementById('score')!.textContent = String(score);
});

// Answer RPCs from the client
aurora.onRpc<[string], boolean>('hud:showToast', async (text) => {
    // ...render a toast...
    return true;
});

// Push something back to the client
aurora.emit('hud:ready');

// Or straight to the server
aurora.emitServer('hud:score:request');

// Or call the server and await a value
const balance = await aurora.invokeServerRpc<number>('money:balance');
```

`aurora` is a singleton `WebviewService`. It auto-detects the runtime (currently RAGE MP's `mp` bridge) and no-ops with a warning when there is no runtime to talk to (useful when developing your webview in a normal browser tab).

## A complete flow

The typical setup for a HUD:

1. **Client** creates the webview on player spawn.
2. **Server** pushes state updates to the webview via `RpcService.invokeWebview`.
3. **Browser** answers RPCs and emits events back when the player interacts with the UI.
4. **Client** destroys the webview on despawn.

```ts title="Client: create and route"
import { Controller, Inject, WEBVIEW_SERVICE } from '@aurora-mp/core';
import { OnServer } from '@aurora-mp/client';
import type { WebviewService } from '@aurora-mp/client';

@Controller()
export class HudController {
    constructor(@Inject(WEBVIEW_SERVICE) private readonly webviews: WebviewService) {}

    @OnServer('player:spawned')
    public onSpawn() {
        this.webviews.create('hud', 'http://packages/hud/index.html');
    }
}
```

```ts title="Server: update the HUD over RPC"
import { Controller, Inject, RPC_SERVICE, Player } from '@aurora-mp/core';
import type { RpcService } from '@aurora-mp/server';

@Controller()
export class ScoreController {
    constructor(@Inject(RPC_SERVICE) private readonly rpc: RpcService) {}

    public async pushScore(@Player() player: unknown, score: number) {
        await this.rpc.invokeWebview(player, 'hud', 'hud:score', score);
    }
}
```

```ts title="Browser: render the score"
import { aurora } from '@aurora-mp/webview';

aurora.onRpc<[number], void>('hud:score', (score) => {
    document.getElementById('score')!.textContent = String(score);
});
```

## When to reach for events vs RPCs

Same rule as everywhere else in the framework:

- **Event** for fire-and-forget notifications ("player spawned", "score changed"). No return value, no timeout, no error propagation.
- **RPC** when you want a value back or need the caller to see errors ("open menu, wait for user choice, return it").

See [RPC](/fundamentals/rpc) and [Controllers & events](/fundamentals/controllers) for the full decorator surface (`@OnWebView`, `@OnWebViewRpc`).

## Next steps

- [Managing WebViews](./managing) covers the client-side lifecycle: `create`, `destroy`, `getById`, and the `onCreate` hook.
- Reference: [`WebviewService`](/api/client/classes/WebviewService), [`IWebView`](/api/core/interfaces/IWebView).
