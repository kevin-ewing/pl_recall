#!/usr/bin/env node

import { existsSync, renameSync, rmSync, rmdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(root, 'web');
const clientOutput = join(web, 'dist', 'client');

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

const requestedBasePath = option('--base-path', process.env.NEXT_PUBLIC_BASE_PATH ?? '');
const basePath = requestedBasePath
  ? `/${requestedBasePath.replace(/^\/+|\/+$/g, '')}`
  : '';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const build = spawnSync(npm, ['run', 'build'], {
  cwd: web,
  env: { ...process.env, NEXT_PUBLIC_BASE_PATH: basePath },
  stdio: 'inherit',
});

if (build.status !== 0) process.exit(build.status ?? 1);

if (basePath) {
  const generatedAssets = join(clientOutput, basePath.slice(1), '_next');
  const artifactAssets = join(clientOutput, '_next');
  if (!existsSync(generatedAssets)) throw new Error(`Expected framework assets at ${generatedAssets}.`);

  rmSync(artifactAssets, { force: true, recursive: true });
  renameSync(generatedAssets, artifactAssets);
  rmdirSync(dirname(generatedAssets));
}

console.log(`Static site ready in ${clientOutput}${basePath ? ` for ${basePath}` : ''}.`);
