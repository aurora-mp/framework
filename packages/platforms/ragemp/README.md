> **Shutdown notice:** RAGE MP is in the process of being shut down by its developers. This package is no longer actively maintained. For new projects, use [`@aurora-mp/platform-fivem`](../fivem) instead. For more information see the [official announcement](https://rage.mp/forums/topic/26561-long-term-eco-system-integration-pt-ii-final-outreach-cd/).

# @aurora-mp/platform-ragemp

RAGE MP platform driver for the [Aurora](https://github.com/aurora-mp/framework) multiplayer framework. Provides server-side and client-side implementations of the Aurora platform interface for existing RAGE MP projects.

## Packages

| Package | Description |
|---|---|
| `@aurora-mp/platform-ragemp-server` | Server-side driver for RAGE MP |
| `@aurora-mp/platform-ragemp-client` | Client-side driver for RAGE MP |

## Installation

```bash
# Server
pnpm add @aurora-mp/platform-ragemp-server

# Client
pnpm add @aurora-mp/platform-ragemp-client
```

> Both packages require `@aurora-mp/core` as a peer dependency. It is pulled in automatically.

## Quick Start

### Server

```typescript
import { createRageApplication } from '@aurora-mp/platform-ragemp-server';
import { AppModule } from './app.module';

const app = await createRageApplication(AppModule);
await app.listen();
```

### Client

```typescript
import { createRageApplication } from '@aurora-mp/platform-ragemp-client';
import { AppModule } from './app.module';

const app = await createRageApplication(AppModule);
await app.listen();
```

> Both factories print a deprecation warning to the console on startup.

## Configuration

The server driver reads configuration from a `.env` file located in the server's working directory. Set `DEBUG=true` to enable debug-level log output.

```env
DEBUG=true
MY_CONFIG_VALUE=hello
```

Values are injected into the Aurora config system and accessible via the `IConfigService` token.
