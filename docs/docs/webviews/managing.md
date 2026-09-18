---
title: Managing WebViews
sidebar_label: Managing WebViews
---

WebViews are created, kept in a registry, and destroyed on the **client** side. Everything else (server pushes, browser handlers) sits on top of that lifecycle.

The API lives on `WebviewService` from `@aurora-mp/client`, injected via the `WEBVIEW_SERVICE` token on the **client-side**

## Creating a WebView

```ts
import { Controller, Inject, WEBVIEW_SERVICE } from '@aurora-mp/core';
import type { WebviewService } from '@aurora-mp/client';

@Controller()
export class HudController {
    constructor(@Inject(WEBVIEW_SERVICE) private readonly webviews: WebviewService) {}

    public open() {
        this.webviews.create('hud', 'http://packages/hud/index.html');
    }
}
```

`create(id, url, focused?, hidden?)` returns an `IWebView` handle:

| Argument   | Type                | Default | Purpose                                                        |
| ---------- | ------------------- | ------- | -------------------------------------------------------------- |
| `id`       | `string \| number`  |         | Unique identifier. All routing (events, RPCs) uses this.       |
| `url`      | `string`            |         | Where to load the bundle from. Usually a `http://packages/...` URL served by the platform. |
| `focused`  | `boolean`           | `false` | Whether the view should receive input focus after creation.    |
| `hidden`   | `boolean`           | `false` | Whether the view starts hidden.                                |

If you call `create` with an `id` that already exists, Aurora logs a warning and overwrites the old view. That's convenient during development, less convenient in production, so guard the call with `getById` if you need idempotency.

## Destroying a WebView

```ts
this.webviews.destroy('hud');
```

`destroy(id)` removes the view from the registry and asks the platform driver to tear down the underlying browser instance. If no view with that id exists, the call is a no-op.

## Looking things up

```ts
const hud = this.webviews.getById('hud'); // IWebView | undefined
const all = this.webviews.getAll();       // IWebView[]
```

`getById` returns `undefined` if the view is gone (or never existed). `getAll` gives you every currently-registered view, useful for broadcasting or debugging.

## Reacting to creation

If you have code that needs to run every time a WebView is created (attaching listeners, initial state push, telemetry), register an `onCreate` listener during boot:

```ts
import { OnAppInit } from '@aurora-mp/core';

@Controller()
export class HudLoggingController implements OnAppInit {
    constructor(@Inject(WEBVIEW_SERVICE) private readonly webviews: WebviewService) {}

    public onAppInit() {
        this.webviews.onCreate((id, webview) => {
            console.log('[hud] new webview', id);
        });
    }
}
```

Listeners fire synchronously after the view is inserted into the registry, before `create` returns to the caller.

## The `IWebView` handle

`create` returns an `IWebView`, and so does `getById`. The interface is intentionally small:

```ts
interface IWebView {
    emit(event: string, ...args: unknown[]): void;
    invoke<T = unknown>(event: string, ...args: unknown[]): Promise<T>;
    destroy(): void;
}
```

- `emit(event, ...args)` sends a fire-and-forget event to the browser side (received via `aurora.on`).
- `invoke(event, ...args)` sends an RPC; the returned promise resolves with whatever the browser handler returns (registered via `aurora.onRpc`).
- `destroy()` is equivalent to `webviews.destroy(id)`, but you can call it directly on the handle when you have it in scope.

## Direct invocation vs the service

`WebviewService` exposes a shortcut for RPC that looks up the view for you:

```ts
await this.webviews.invokeWebview<T>('hud', 'get:state');
```

This is the same as:

```ts
const hud = this.webviews.getById('hud');
if (!hud) throw new Error('hud not registered');
await hud.invoke<T>('get:state');
```

Use the service call when you only have the id; use the handle when you already have it and want to skip the lookup.

## Where to load the URL from

The `url` argument is passed verbatim to the platform driver. On RAGE MP, `http://packages/<resource>/<path>` serves files from the resource's `packages/` directory; on FiveM you'd typically serve from `nui://<resource>/<path>` (the FiveM driver's WebView support is experimental at time of writing).

Either way, the browser bundle should import `@aurora-mp/webview` so `aurora.on`/`aurora.emit`/`aurora.onRpc`/`aurora.invokeServerRpc` are available inside the page.

## Common patterns

### Per-scene HUDs

Give each screen its own id (`hud`, `menu`, `chat`) and destroy the ones you don't need. Multiple views can coexist; routing stays clean because ids are unique.

### Development in a normal browser

The browser-side `WebviewService` detects when it's not running inside a game runtime and no-ops with a warning. Your bundle still boots, which lets you develop the UI in a plain browser tab with mock data.

### Cleanup on player drop

Because the client owns the registry, WebViews are automatically gone when the client shuts down (game exit, disconnect). If you want to reap views mid-session (say, on death/respawn), destroy them explicitly.

## Next steps

- Go back to the [WebViews overview](./overview) for the mental model.
- Look at the decorator surface (`@OnWebView`, `@OnWebViewRpc`) in [Controllers & events](/fundamentals/controllers) and [RPC](/fundamentals/rpc).
