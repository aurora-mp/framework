---
title: Installation
sidebar_label: Installation
---

There are two ways to start with aurora-mp: scaffold a new project with the CLI, or add the packages to an existing one.

## Option 1. Scaffold with the CLI (recommended)

The `@aurora-mp/cli` generates a preconfigured workspace from a platform template.

```bash
npx @aurora-mp/cli init
```

The command will interactively ask for:

- **Project name**: used as the `name` field in `package.json`.
- **Destination directory**: where the project is created.
- **Package manager**: `npm`, `yarn`, or `pnpm`.

It then copies the selected template, wires up the workspace (either `pnpm-workspace.yaml` or a `workspaces` field), and optionally runs `install` for you.

Two templates are available today: `ragemp` and `fivem` *(experimental)*. Pass `--template <name>` to skip the interactive prompt:

```bash
npx @aurora-mp/cli init --template fivem
```

Once the project is ready:

```bash
cd my-ragemp-app
pnpm install   # if you skipped the install step
pnpm run dev
```

## Option 2. Manual install

Every install pairs `@aurora-mp/core` + `reflect-metadata` with a **side** package (`server` or `client`) and its matching **platform driver**:

```bash
pnpm add @aurora-mp/core reflect-metadata @aurora-mp/<side> @aurora-mp/platform-<platform>-<side>
```

| Side       | RAGE MP                             | FiveM *(experimental)*              |
| ---------- | ----------------------------------- | ----------------------------------- |
| **Server** | `@aurora-mp/platform-ragemp-server` | `@aurora-mp/platform-fivem-server`  |
| **Client** | `@aurora-mp/platform-ragemp-client` | `@aurora-mp/platform-fivem-client`  |

Add `@aurora-mp/webview` to your browser bundle if your gamemode renders in-game UI.

## Verifying the install

Create an entry file that boots the framework with the platform driver. For a RAGE MP server:

```ts
import 'reflect-metadata';
import { createRageApplication } from '@aurora-mp/platform-ragemp-server';
import { AppModule } from './app.module';

createRageApplication(AppModule);
```

For a FiveM server:

```ts
import 'reflect-metadata';
import { createFiveMApplication } from '@aurora-mp/platform-fivem-server';
import { AppModule } from './app.module';

await createFiveMApplication(AppModule);
```

Run your build, boot the platform's server, and you should see aurora-mp's logger initialise before your `AppModule` is loaded.

## Next steps

- Head to the API reference for [`@aurora-mp/core`](/api/core) to explore modules, decorators, and services.
- Read the [Requirements](./requirements) page if you skipped it.
