const esbuild = require('esbuild');
const { dependencies, devDependencies, peerDependencies } = require('./package.json');
const wasmPkg = "./pkg/ghidora.js";
const ghidoraConfig = "./ghidora.config.mjs";

// Combine all dependencies to exclude from the bundle
const externals = [
    ...Object.keys(dependencies || {}),
    ...Object.keys(devDependencies || {}),
    ...Object.keys(peerDependencies || {}),
    wasmPkg,
    ghidoraConfig
];

esbuild.build({
    entryPoints: ['./src/main.ts'],
    bundle: true,
    outfile: './dist/bundle.main.cjs',
   // outfile: 'bundle.main.cjs',
    external: externals,
    platform: 'node', // Use 'browser' if targeting browser
    sourcemap: true, // Generate source maps
    minify: false,
    format: 'cjs', // CommonJS format; change to 'esm' for ES module output
}).catch(() => process.exit(1));
