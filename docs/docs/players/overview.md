---
title: Players overview
sidebar_label: Overview
---

Aurora Framework wraps every connected player in a `PlayerEntity`, a framework-owned object that gives you portable access to platform APIs (name, position, dimension, model, health), a way to send events and RPCs, and a slot for **per-player state**.

The wrapper is deliberately thin. Behaviour lives on the wrapper; **data** (accounts, inventories, wallets) lives on separate objects called [components](./components) that you attach to it.

## Structure

| Piece                | Where it lives                                | Purpose                                                  |
| -------------------- | --------------------------------------------- | -------------------------------------------------------- |
| `PlayerEntity`       | Created per player by the framework           | Behaviour surface: platform getters, `emit` / `invoke`, `get<Component>()`. |
| `PlayerRegistry`     | Global singleton, injected via DI             | Store of live wrappers keyed by source id.               |
| `@PlayerComponent`   | Your own classes, registered as providers     | Per-player state and behaviour attached at join time.    |
| `PlayerExtender`     | Object registered with `app.extendPlayer(...)` | Low-ceremony hook for one-off augmentations via an untyped `ext` bag. |

The framework wires the lifecycle automatically. When the platform driver signals a player joining, Aurora creates the wrapper, resolves every component from the DI container, calls each component's `onAttach`, then runs your extenders. On disconnect the same sequence runs in reverse.

## The `PlayerEntity` API

Injecting the registry (or receiving a player via `@Player()`) gives you a wrapper with a consistent surface across platforms.

Every getter delegates to the platform driver. If the current driver doesn't implement a hook (say, `getPlayerHeading` on a minimal driver), the getter returns `undefined` rather than throwing.

## The `PlayerRegistry`

Inject `PlayerRegistry` anywhere you need to look up players by source id or iterate the currently-connected set.

```ts
import { Controller, Injectable } from '@aurora-mp/core';
import { PlayerRegistry } from '@aurora-mp/core';

@Controller()
export class AnnounceController {
    constructor(private readonly players: PlayerRegistry) {}

    public broadcast(text: string) {
        for (const player of this.players.list()) {
            player.emit('chat:message', text);
        }
    }

    public findBySource(source: number) {
        return this.players.get(source); // PlayerEntity | undefined
    }
}
```

`get(source)` returns `undefined` when the player is not currently registered (pre-join or already dropped). `list()` returns a snapshot array of wrappers.

You never call `create` or `destroy` yourself. The framework calls them from the driver's normalised `onPlayerJoin` / `onPlayerDrop` hooks. On drivers that don't expose those hooks, per-player lifecycle isn't wired and components/extenders don't run.

## Getting a player into a handler

Use the `@Player()` parameter decorator on any event or RPC handler and Aurora hands you the wrapper for the player that triggered the call.

```ts
import { Controller, Player } from '@aurora-mp/core';
import { OnClient } from '@aurora-mp/server';
import type { PlayerEntity } from '@aurora-mp/core';

@Controller()
export class SpawnController {
    @OnClient('player:spawn')
    public onSpawn(@Player() player: PlayerEntity) {
        player.emit('spawn:ack');
        console.log(`${player.name} spawned at`, player.position);
    }
}
```

Handler-level access is the common case. Reach for `PlayerRegistry` when you need a wrapper **outside** an event context (a scheduled task, a service method called by another controller).

## Two ways to extend

The framework offers two distinct extension styles. The choice depends on how much structure you want.

- **[Player components](./components)** the primary mechanism. A class marked with `@PlayerComponent()` gets instantiated once per player (with full DI resolution), attached to the wrapper, and retrieved via `player.get(WalletComponent)`. Components have `onAttach` / `onDetach` lifecycle hooks. Use them for anything that has real state or behaviour.
- **`PlayerExtender`** an untyped escape hatch. A plain object with an `onAttach(player, container)` hook that mutates the wrapper's `ext` bag. Cheap to add, no DI wiring, no typing unless you augment the module yourself. Use it for prototyping or one-off flags.

Rule of thumb: reach for a component first. Fall back to an extender only when the ceremony genuinely isn't worth it.

## Lifecycle

Boot order per player, both on join and drop:

```
onPlayerJoin(source)                onPlayerDrop(source)
    │                                     │
    ▼                                     ▼
new PlayerEntity(source, native)   cancelPlayerRpcs(source)
    │                                     │
    ▼                                     ▼
resolve + attach components         run extenders (reverse order)
    │                                     │
    ▼                                     ▼
component onAttach                  detach components (reverse order)
    │                                     │
    ▼                                     ▼
extender onAttach                   evict wrapper from registry
```

Attach errors on a component are logged but do not block subsequent components (the player still joins). Detach errors are logged but do not block eviction.

## Next steps

- Add per-player state with [Player components](./components).
- Reference: [`PlayerEntity`](/api/core/classes/PlayerEntity), [`PlayerRegistry`](/api/core/classes/PlayerRegistry).
