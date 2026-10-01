#!/usr/bin/env node
// Bundles reader-web/ with foliate-js into assets/reader/app/reader.js.
//   node scripts/build-reader.mjs [--dev] [--watch]
import { context, build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const watch = args.has('--watch');
const dev = watch || args.has('--dev');

const outfile = path.join(root, 'assets', 'reader', 'app', 'reader.js');
// An already generated android/ project gets a copy too, so a plain Gradle
// build picks up the new bundle without a prebuild.
const androidCopy = path.join(
  root,
  'android',
  'app',
  'src',
  'main',
  'assets',
  'app',
  'reader.js',
);

const copyToAndroid = {
  name: 'copy-to-android',
  setup(pluginBuild) {
    pluginBuild.onEnd(result => {
      if (result.errors.length || !fs.existsSync(path.join(root, 'android'))) {
        return;
      }
      fs.mkdirSync(path.dirname(androidCopy), { recursive: true });
      fs.copyFileSync(outfile, androidCopy);
    });
  },
};

const options = {
  entryPoints: [path.join(root, 'reader-web', 'src', 'main.ts')],
  bundle: true,
  format: 'iife',
  // Android System WebView; CSS custom highlights need Chromium 105.
  target: ['chrome105'],
  outfile,
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  legalComments: 'eof',
  banner: {
    js: '/* LNReader web reader. Includes foliate-js (readest fork) — MIT License, Copyright (c) 2022 John Factotum. */',
  },
  logLevel: 'info',
  plugins: [copyToAndroid],
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
