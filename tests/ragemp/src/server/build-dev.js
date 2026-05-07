import esbuild from 'esbuild';
import esbuildPluginTsc from 'esbuild-plugin-tsc';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = require('./package.json');
const rootPackageJson = require('../../package.json');

console.log('🔨 Building server...');
console.log('📦 Using package.json:', packageJson.name);
console.log('📦 Using root package.json:', rootPackageJson.name);

const polyfillsBanner = `
	if (!Object.hasOwn) {
		Object.hasOwn = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
	}
`;

const config = {
    entryPoints: ['src/index.ts'],
    outfile: '../../packages/aurora-mp/index.js',
    bundle: true,
    platform: 'node',
    target: 'node14',
    format: 'cjs',
    sourcemap: false,
    keepNames: true,
    minify: false,
    logLevel: 'info',
    banner: { js: polyfillsBanner },
    plugins: [esbuildPluginTsc()],
    external: [
        ...Object.keys(packageJson.devDependencies || {}),
        ...Object.keys(rootPackageJson.devDependencies || {}),
    ],
};

const ctx = await esbuild.context(config);

ctx.watch();
