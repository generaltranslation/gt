#!/usr/bin/env node

// Routes to proper binary based on platform. Binaries ship in per-platform
// optional dependencies (@generaltranslation/gt-<os>-<arch>); a local
// binaries/ directory is the fallback for development builds.

import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, chmodSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

function detectPlatform() {
  const platform = process.platform;
  const arch = process.arch;

  // Map Node.js platform/arch to our target names
  const platformMap: Record<string, Record<string, string>> = {
    darwin: {
      x64: 'darwin-x64',
      arm64: 'darwin-arm64',
    },
    linux: {
      x64: 'linux-x64',
      arm64: 'linux-arm64',
    },
    win32: {
      x64: 'win32-x64',
    },
  };

  return platformMap[platform]?.[arch] || null;
}

function binaryFileName(target: string): string {
  return target === 'win32-x64' ? 'gt-win32-x64.exe' : `gt-${target}`;
}

function platformPackageName(target: string): string {
  return `@generaltranslation/gt-${target}`;
}

function resolveBinary(target: string): string | null {
  // Installed layout: the platform-specific optional dependency
  try {
    return require.resolve(
      `${platformPackageName(target)}/${binaryFileName(target)}`
    );
  } catch {
    // Fall through to the development layout
  }

  // Development layout: binaries/ next to dist/ in the package root
  const localPath = join(
    __dirname,
    '..',
    '..',
    'binaries',
    binaryFileName(target)
  );
  if (existsSync(localPath)) {
    return localPath;
  }

  return null;
}

function routeToBinary(): void {
  const target = detectPlatform();

  if (!target) {
    console.error(`Unsupported platform: ${process.platform}-${process.arch}`);
    process.exit(1);
  }

  const binaryPath = resolveBinary(target);

  if (!binaryPath) {
    console.error(
      `Could not find the gt binary for your platform (${process.platform}-${process.arch}).\n` +
        `It ships in the optional dependency "${platformPackageName(target)}",\n` +
        `which package managers install automatically. It can be missing when a\n` +
        `lockfile was created with --omit=optional or on a different platform.\n` +
        `Try deleting node_modules and your lockfile, then reinstalling.`
    );
    process.exit(1);
  }

  // Check and fix execute permissions if needed (Unix-like systems only)
  if (process.platform !== 'win32') {
    try {
      const stats = statSync(binaryPath);
      const isExecutable = !!(stats.mode & parseInt('100', 8)); // Check owner execute bit

      if (!isExecutable) {
        chmodSync(binaryPath, 0o755); // Make executable
      }
    } catch {
      // If we can't check/fix permissions, continue anyway
      // The spawn might still work or give a more meaningful error
    }
  }

  // Spawn the appropriate binary with all arguments
  const child = spawn(binaryPath, process.argv.slice(2), {
    stdio: 'inherit',
  });

  child.on('close', (code) => {
    // code might be null
    process.exit(code ?? 1);
  });

  child.on('error', () => {
    process.exit(1);
  });

  return;
}

// Entry point
routeToBinary();
