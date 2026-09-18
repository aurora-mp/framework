---
title: Guards
sidebar_label: Guards
---

Guards are small classes that run **before** a controller method executes and decide whether the call is allowed. They are Aurora Framework's equivalent of authorisation middleware: think permission checks, rate limiting, feature flags, session validation.

A guard returns `true` to let the call through and `false` to block it. Blocked calls short-circuit silently (the method never runs), with a debug log noting which guard denied the request.

## Writing a guard

Implement the `Guard` interface and mark the class as `@Injectable()` so the container can construct it and wire up any dependencies.

```ts title="src/auth/auth.guard.ts"
import { Injectable, type Guard, type ExecutionContext } from '@aurora-mp/core';

@Injectable()
export class AuthGuard implements Guard {
    public canActivate(context: ExecutionContext): boolean {
        const player = context.getPlayer() as { authenticated?: boolean } | undefined;
        return player?.authenticated === true;
    }
}
```

`canActivate` may return a boolean or a `Promise<boolean>`. Guards are awaited in order, so async checks (database lookups, remote calls) work exactly as you'd expect.

## The `ExecutionContext`

Every guard receives an `ExecutionContext` with everything it needs to reason about the call. The main getters:

| Member                   | What it gives you                                                       |
| ------------------------ | ----------------------------------------------------------------------- |
| `context.name`           | The event or RPC name being handled.                                    |
| `context.args`           | The raw arguments the driver delivered.                                 |
| `context.payload`        | Convenience alias for the meaningful payload argument.                  |
| `context.player`         | Player object attached to the event, if any.                            |
| `context.source`         | Platform source id (FiveM only).                                        |
| `context.getClass()`     | The controller class defining the current handler.                      |
| `context.getHandler()`   | The method function being called.                                       |
| `context.getPlayer()`    | Same as `context.player`, as a method.                                  |

`getClass()` and `getHandler()` are useful for **reflective guards**: guards that read extra metadata off the class or method to decide what to do. You can attach that metadata with a custom decorator built on `SetMetadata`.

## Registering guards

Use `@UseGuards(...)` on the class, the method, or both. Guards run in the order they're declared; class-level guards fire before method-level ones.

### On a single method

```ts
import { Controller, UseGuards } from '@aurora-mp/core';
import { OnClient } from '@aurora-mp/server';
import { AuthGuard } from './auth.guard';

@Controller()
export class AccountController {
    @UseGuards(AuthGuard)
    @OnClient('account:rename')
    public onRename() {}
}
```

### On the whole controller

```ts
@UseGuards(AuthGuard)
@Controller()
export class AccountController {
    @OnClient('account:rename')
    public onRename() {}

    @OnClient('account:delete')
    public onDelete() {}
}
```

### Stacking

You can combine the two. Class guards run first, then method guards. Order within a level matches declaration order.

```ts
@UseGuards(AuthGuard)
@Controller()
export class AdminController {
    @UseGuards(RoleGuard)
    @OnClient('admin:ban')
    public onBan() {}
}
```

`AuthGuard.canActivate` runs first; if it returns `true`, `RoleGuard.canActivate` runs; if that also returns `true`, `onBan` executes.

## Guards need to be registered as providers

Because Aurora resolves guards through the DI container, every guard class you use must be a **provider** in some module reachable from your root:

```ts
@Module({
    providers: [AuthGuard, RoleGuard],
    controllers: [AccountController, AdminController],
    exports: [AuthGuard, RoleGuard],
})
export class AuthModule {}
```

If a guard depends on a service (say, a `SessionService`), the container injects it just like any other constructor dependency.

```ts
@Injectable()
export class RoleGuard implements Guard {
    constructor(private readonly sessions: SessionService) {}

    public async canActivate(context: ExecutionContext): Promise<boolean> {
        const player = context.getPlayer() as { id: number } | undefined;
        if (!player) return false;
        const roles = await this.sessions.getRoles(player.id);
        return roles.includes('admin');
    }
}
```

## Reading custom metadata

For rules that vary per handler (`@Roles('admin')`, `@RateLimit(5)`), pair a custom decorator with a guard that reads the metadata off `context.getHandler()`.

```ts title="src/auth/roles.decorator.ts"
import { SetMetadata } from '@aurora-mp/core';

export const ROLES_KEY = 'aurora:roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

```ts title="src/auth/roles.guard.ts"
@Injectable()
export class RolesGuard implements Guard {
    public canActivate(context: ExecutionContext): boolean {
        const required: string[] =
            Reflect.getMetadata(ROLES_KEY, context.getHandler()) ?? [];
        if (required.length === 0) return true;
        const player = context.getPlayer() as { roles: string[] } | undefined;
        return required.every((r) => player?.roles.includes(r) ?? false);
    }
}
```

```ts
@Controller()
export class AdminController {
    @UseGuards(RolesGuard)
    @Roles('admin')
    @OnClient('admin:ban')
    public onBan() {}
}
```

## What happens on denial

When a guard returns `false`:

- The controller method is **not** invoked.
- Aurora emits a debug log: `Access denied by <GuardName> on <ControllerName>.<methodName>`.
- The event returns nothing (the underlying driver just sees a silent handler).

If you need to signal denial back to the caller (for example, to a webview making an RPC), throw from inside the guard or return an explicit response from a wrapper method.

## Next steps

- See how guards fit alongside events in [Controllers & events](./controllers).
- Reference: [`Guard`](/api/core/interfaces/Guard) and [`ExecutionContext`](/api/core/interfaces/ExecutionContext).
