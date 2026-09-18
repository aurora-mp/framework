> Warning: This package is in early development and may contain breaking changes. Use with caution.

# @aurora-mp/platform-fivem

FiveM platform driver for the [Aurora](https://github.com/aurora-mp/framework) multiplayer framework. Provides server-side and client-side implementations of the Aurora platform interface, enabling you to build FiveM resources using Aurora's dependency injection, event system, and RPC layer.

## Packages

| Package | Description |
|---|---|
| `@aurora-mp/platform-fivem-server` | Server-side driver for FiveM |
| `@aurora-mp/platform-fivem-client` | Client-side driver for FiveM |

## Installation

```bash
# Server
pnpm add @aurora-mp/platform-fivem-server

# Client
pnpm add @aurora-mp/platform-fivem-client
```

> Both packages require `@aurora-mp/core` as a peer dependency. It is pulled in automatically.

## Quick Start

### Server

```typescript
import { createFiveMApplication } from '@aurora-mp/platform-fivem-server';
import { AppModule } from './app.module';

const app = await createFiveMApplication(AppModule);
await app.listen();
```

### Client

```typescript
import { createFiveMClientApplication } from '@aurora-mp/platform-fivem-client';
import { AppModule } from './app.module';

const app = await createFiveMClientApplication(AppModule);
await app.listen();
```

## Configuration

The server driver reads configuration from a `.env` file located in the resource's working directory. Set `DEBUG=true` to enable debug-level log output.

```env
DEBUG=true
MY_CONFIG_VALUE=hello
```

Values are injected into the Aurora config system and accessible via the `IConfigService` token.