import esbuild from 'esbuild';
import esbuildPluginTsc from 'esbuild-plugin-tsc';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = require('./package.json');
const rootPackageJson = require('../../package.json');

console.log('🔨 Building client...');
console.log('📦 Using package.json:', packageJson.name);
console.log('📦 Using root package.json:', rootPackageJson.name);

const config = {
    entryPoints: ['src/index.ts'],
    outfile: '../../client_packages/index.js',
    bundle: true,
    platform: 'node',
    target: 'node14',
    format: 'cjs',
    sourcemap: 'inline',
    keepNames: true,
    minify: true,
    logLevel: 'info',
    plugins: [esbuildPluginTsc()],
    external: [
        ...Object.keys(packageJson.devDependencies || {}),
        ...Object.keys(rootPackageJson.devDependencies || {}),
    ],
};

const ctx = await esbuild.context(config);
ctx.watch();
