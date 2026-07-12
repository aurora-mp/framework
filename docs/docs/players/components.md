---
title: Player components
sidebar_label: Components
---

A **player component** is a class attached to a `PlayerEntity` at join time. Aurora Framework instantiates one per player (through the DI container, so components can inject services), keeps it alive until the player disconnects, and hands it back to any handler that asks for it via `player.get(ComponentClass)`.

This is where per-player state and behaviour belong: wallets, inventories, session data, ability cooldowns, anything scoped to a single player's session.

## Defining a component

Mark a class with `@PlayerComponent()`. That both flags the class as a component **and** registers it as an `@Injectable()` provider with `TRANSIENT` scope (so a fresh instance is built per player).

```ts title="src/wallet/wallet.component.ts"
import { PlayerComponent, type IPlayerComponent, type PlayerEntity, Inject } from '@aurora-mp/core';
import { DatabaseService } from '../database/database.service';

@PlayerComponent()
export class WalletComponent implements IPlayerComponent {
    private balance = 0;

    constructor(private readonly db: DatabaseService) {}

    public async onAttach(player: PlayerEntity): Promise<void> {
        this.balance = await this.db.loadBalance(player.source);
    }

    public async onDetach(player: PlayerEntity): Promise<void> {
        await this.db.saveBalance(player.source, this.balance);
    }

    public getBalance(): number {
        return this.balance;
    }

    public deposit(amount: number): void {
        this.balance += amount;
    }
}
```

Both `onAttach` and `onDetach` are optional. A component with neither is a plain per-player container.

## Registering the component

Components are ordinary providers. Register them in some module reachable from the root:

```ts title="src/wallet/wallet.module.ts"
import { Module } from '@aurora-mp/core';
import { WalletComponent } from './wallet.component';

@Module({
    providers: [WalletComponent],
})
export class WalletModule {}
```

No `exports` is needed. The framework's `PlayerComponentRegistry` scans every provider marked with `@PlayerComponent()` at boot and attaches them to every player, regardless of which module owns them.

## Reading a component

Any code that has a `PlayerEntity` (from `@Player()`, from `PlayerRegistry.get`, from a handler receiving a wrapper) can pull the component out:

```ts
import { Controller, Player } from '@aurora-mp/core';
import { OnClient } from '@aurora-mp/server';
import type { PlayerEntity } from '@aurora-mp/core';
import { WalletComponent } from '../wallet/wallet.component';

@Controller()
export class ShopController {
    @OnClient('shop:buy')
    public onBuy(@Player() player: PlayerEntity, itemId: string) {
        const wallet = player.get(WalletComponent);
        if (wallet.getBalance() < 100) {
            player.emit('shop:error', 'Not enough money');
            return;
        }
        wallet.deposit(-100);
        player.emit('shop:success', itemId);
    }
}
```

`player.get(ComponentClass)` throws when the component isn't attached. That catches programmer mistakes early (forgetting to include the component's module) instead of forcing null-checks at every call site. Use `player.has(ComponentClass)` when the presence is genuinely optional.

## Scope and identity

`@PlayerComponent()` implicitly applies `@Injectable({ scope: Scope.TRANSIENT })` when no scope has been set. Every player gets a fresh instance. Do not override this to `SINGLETON` unless you have a very specific reason (and know that the "single" instance will still be resolved once per player).

The **class** is the identity token. Two components are the same only if they are the same class. That means:

- Subclassing a component to specialise it produces a distinct token and is retrieved with the subclass name.
- If you re-export the same class from two barrel files, `player.get(A)` and `player.get(A')` must resolve to the same class object, otherwise the lookup fails.

## Injecting other things into a component

Because components go through the container, they can inject anything a normal provider can: services from `@Global()` modules, framework tokens, factories.

```ts
@PlayerComponent()
export class SessionComponent {
    constructor(
        @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
        private readonly config: ConfigService,
    ) {}
}
```

If a component's dependency is expensive to build (a DB pool, an HTTP client), keep the dependency itself a `SINGLETON` provider and inject that. Only the component instance is per-player.

## Patterns

### Sibling access

Read another component during a handler, not during `onAttach`, unless you understand the ordering constraint above:

```ts
@PlayerComponent()
export class InventoryComponent implements IPlayerComponent {
    public onAttach() {} // no work here
    public canAfford(player: PlayerEntity, cost: number) {
        return player.get(WalletComponent).getBalance() >= cost;
    }
}
```

### Optional components

Some players may not have a component (feature flag, role-gated). Check before reading:

```ts
if (player.has(AdminComponent)) {
    player.get(AdminComponent).notify(message);
}
```

### Persisting on disconnect

Save state in `onDetach`. Detach hooks are awaited, so async persistence works. Don't rely on a shutdown hook to save all players; the driver runs `onPlayerDrop` per player, not a single "drop all" event.

## Next steps

- Back to the [Players overview](./overview) for the mental model.
- Reference: [`IPlayerComponent`](/api/core/interfaces/IPlayerComponent), [`PlayerComponentRegistry`](/api/core/classes/PlayerComponentRegistry).
