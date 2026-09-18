---
title: Providers & dependency injection
sidebar_label: Providers & DI
---

Aurora Framework ships with a small dependency-injection container. **Providers** are the things the container knows how to hand out; **consumers** (controllers, other providers) declare what they need in their constructor and the container resolves it for them.

If you've used NestJS, the shape is deliberately similar.

## Marking a class as injectable

Any class registered as a provider must be decorated with `@Injectable()`. This flags the class for the container and stores its **scope** in metadata.

```ts title="src/user.service.ts"
import { Injectable } from '@aurora-mp/core';

@Injectable()
export class UserService {
    public greet(name: string) {
        return `hello, ${name}`;
    }
}
```

Register it in the module's `providers` array:

```ts title="src/app.module.ts"
import { Module } from '@aurora-mp/core';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
    controllers: [UserController],
    providers: [UserService],
})
export class AppModule {}
```

## Consuming a provider

The container reads constructor parameter types (via `emitDecoratorMetadata`) and resolves them from the module's DI scope. No `@Inject` is needed when the type itself is the token:

```ts title="src/user.controller.ts"
import { Controller } from '@aurora-mp/core';
import { OnClient } from '@aurora-mp/server';
import { UserService } from './user.service';

@Controller()
export class UserController {
    constructor(private readonly users: UserService) {}

    @OnClient('user:greet')
    public onGreet() {
        return this.users.greet('world');
    }
}
```

## Custom tokens with `@Inject`

Class references make bad tokens for framework-level services (interface, no runtime type) and for plain values (configs, constants). In those cases use a `string` or `symbol` token and `@Inject`:

```ts
import { Inject, LOGGER_SERVICE, type ILogger } from '@aurora-mp/core';

@Injectable()
export class AuditService {
    constructor(@Inject(LOGGER_SERVICE) private readonly logger: ILogger) {}
}
```

`@Inject` also works on class properties, if you prefer property injection over constructor injection:

```ts
@Injectable()
export class AuditService {
    @Inject(LOGGER_SERVICE)
    private readonly logger!: ILogger;
}
```

## Provider forms

A `Provider` entry in a module can take four shapes:

### 1. Shorthand: a class

```ts
providers: [UserService]
```

Equivalent to `{ provide: UserService, useClass: UserService }`. The token *is* the class.

### 2. `useClass`: swap the implementation

Bind a token to a different class. Handy for testing or platform-specific implementations.

```ts
providers: [
    { provide: UserService, useClass: MockUserService },
]
```

### 3. `useValue`: a fixed value

Inject any pre-built value: a config object, a constant, a mock.

```ts
export const APP_CONFIG = Symbol.for('APP_CONFIG');

providers: [
    { provide: APP_CONFIG, useValue: { serverName: 'aurora-mp' } },
]
```

Consume it with `@Inject(APP_CONFIG)`.

### 4. `useFactory`: build it lazily

For providers that need setup logic or depend on other providers, use a factory. Declare its dependencies in `inject`:

```ts
providers: [
    {
        provide: DatabaseConnection,
        useFactory: async (config: AppConfig) => {
            const conn = new DatabaseConnection(config.dsn);
            await conn.connect();
            return conn;
        },
        inject: [{ token: APP_CONFIG }],
    },
]
```

Factories may return a `Promise`, the container awaits it before the value is handed out.

## Scopes

`@Injectable()` accepts an options object. The only current option is the lifetime scope:

| Scope                | Behaviour                                          |
| -------------------- | -------------------------------------------------- |
| `Scope.SINGLETON`    | One shared instance for the whole application *(default)*. |
| `Scope.TRANSIENT`    | A fresh instance for every injection.              |

```ts
import { Injectable, Scope } from '@aurora-mp/core';

@Injectable({ scope: Scope.TRANSIENT })
export class RequestContext {}
```

`useClass` / `useValue` / `useFactory` providers accept the same `scope` field at the provider level.

## Sharing providers across modules

By default a provider is only visible inside its own module. To let another module inject it, add its token to `exports`:

```ts
@Module({
    providers: [UserService],
    exports: [UserService],
})
export class UserModule {}
```

Then import `UserModule` from any consumer module:

```ts
@Module({
    imports: [UserModule],
    controllers: [ProfileController],
})
export class ProfileModule {}
```

## Global modules

For cross-cutting services (logging, config, database) you don't want to import a module everywhere. Decorate the module with `@Global()` and its exports become available in every module without an explicit `imports` entry:

```ts
import { Global, Module } from '@aurora-mp/core';

@Global()
@Module({
    providers: [ConfigService],
    exports: [ConfigService],
})
export class ConfigModule {}
```

`ServerModule`, `ClientModule`, and the platform modules use this mechanism internally. That's how `LOGGER_SERVICE` is available everywhere without you importing anything.

## Next steps

- Browse the [Core API reference](/api/core) for the full set of tokens and interfaces.
- Read the [`Container`](/api/core/classes/Container) reference if you need to resolve providers imperatively.
