#!/usr/bin/env node
// Builds the analysis (`native/`, Rust) as a Node addon for this machine, and
// puts it in `dist/native` with its loader. `--debug` builds without optimizations.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const crate = path.join(root, 'native');
const output = path.join(root, 'dist', 'native');
const profile = process.argv.includes('--debug') ? 'debug' : 'release';

const LIBRARY = {
  darwin: 'libparaglide_context_native.dylib',
  linux: 'libparaglide_context_native.so',
  win32: 'paraglide_context_native.dll',
};

/** As the loader names the addon it looks for: "darwin-arm64", "linux-x64-gnu", "win32-x64-msvc". */
function platformName() {
  const { platform, arch } = process;
  if (platform === 'win32') return `win32-${arch}-msvc`;
  if (platform !== 'linux') return `${platform}-${arch}`;

  const isGlibc = Boolean(
    process.report?.getReport()?.header?.glibcVersionRuntime
  );

  return `linux-${arch}-${isGlibc ? 'gnu' : 'musl'}`;
}

const library = LIBRARY[process.platform];
if (!library) {
  console.error(`The analysis is not built for ${process.platform}.`);
  process.exit(1);
}

const cargo = spawnSync(
  'cargo',
  [
    'build',
    ...(profile === 'release' ? ['--release'] : []),
    '--manifest-path',
    path.join(crate, 'Cargo.toml'),
  ],
  { stdio: 'inherit' }
);
if (cargo.error || cargo.status !== 0) {
  if (cargo.error)
    console.error(
      `cargo could not be run: ${cargo.error.message}. The analysis needs Rust to build: https://rustup.rs`
    );
  process.exit(cargo.status ?? 1);
}

fs.mkdirSync(output, { recursive: true });
fs.copyFileSync(
  path.join(crate, 'target', profile, library),
  path.join(output, `paraglide-context.${platformName()}.node`)
);
for (const file of ['binding.cjs', 'binding.d.cts']) {
  fs.copyFileSync(path.join(crate, file), path.join(output, file));
}
