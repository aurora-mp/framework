import { defineConfig } from 'tsup';
import packageJson from './package.json' assert { type: 'json' };

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    splitting: false,
    sourcemap: false,
    clean: true,
    bundle: true,
    minify: false,
    dts: true,
    experimentalDts: false,
    external: [...Object.keys(packageJson.dependencies || {})],
    noExternal: [...Object.keys(packageJson.devDependencies)],
});
