---
title: Requirements
sidebar_label: Requirements
---

Before installing aurora-mp, make sure your development and runtime environments satisfy the following.

## Runtime

- **Node.js**, any active LTS release (20 or 22 recommended).
- A supported multiplayer platform:
  - **FiveM**
  - **RAGE MP**

## Toolchain

- **TypeScript** ≥ 5. aurora-mp relies on decorator metadata, so `experimentalDecorators` and `emitDecoratorMetadata` must both be enabled.
- **pnpm** ≥ 10 (recommended). npm and yarn also work.
- A bundler that preserves decorator metadata: `tsup`, `esbuild`, `swc`, or `webpack` with a TypeScript loader.

## Runtime dependency

aurora-mp uses `reflect-metadata` to read decorator metadata at runtime. Import it once, at the very top of your entry point:

```ts
import 'reflect-metadata';
```

## Minimum `tsconfig.json`

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true,
        "strict": true
    }
}
```

## Editor

Any editor with a modern TypeScript language service works. **VS Code** is recommended for first-class decorator support out of the box.
