
import esbuild from 'esbuild';
import pkg from './package.json' assert { type: 'json' };

const {
  dependencies = {},
  devDependencies = {},
  peerDependencies = {} 
} = pkg;

const externals = [
  ...Object.keys(dependencies),
  ...Object.keys(devDependencies),
  ...Object.keys(peerDependencies)
];

const isDev = process.env.NODE_ENV === 'development';

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  platform: 'node',
  format: 'esm',
  sourcemap: isDev,
  minify: !isDev,
  external: externals,
  target: 'es2022'
});

if (isDev) {
  console.log('[esbuild] watch mode');
  await ctx.watch();
} else {
  console.log('[esbuild] production build');
  await ctx.rebuild();
  await ctx.dispose();
}
