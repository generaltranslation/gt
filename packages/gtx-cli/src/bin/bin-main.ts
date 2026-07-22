#!/usr/bin/env node

// Routes to proper binary based on platform. Binaries ship in per-platform
// optional dependencies (@generaltranslation/gtx-cli-<os>-<arch>); a local
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
  return target === 'win32-x64' ? 'gtx-cli-win32-x64.exe' : `gtx-cli-${target}`;
}

function platformPackageName(target: string): string {
  return `@generaltranslation/gtx-cli-${target}`;
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

// The bin variant still ships the full JS implementation in dist/, so a
// missing binary degrades to the JS CLI instead of failing outright
function runJsFallback(reason: string): void {
  console.error(`${reason}\nFalling back to the JS implementation of gtx-cli.`);
  import('../main.js').catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
      console.error(
        `The JS fallback failed to load (${message}).\n` +
          `Try deleting node_modules and your lockfile, then reinstalling.`
      );
    } else {
      console.error(`gtx-cli failed while running the JS fallback: ${message}`);
    }
    process.exit(1);
  });
}

function routeToBinary(): void {
  const target = detectPlatform();

  if (!target) {
    runJsFallback(
      `No prebuilt gtx-cli binary exists for your platform (${process.platform}-${process.arch}).`
    );
    return;
  }

  const binaryPath = resolveBinary(target);

  if (!binaryPath) {
    runJsFallback(
      `Could not find the gtx-cli binary for your platform (${process.platform}-${process.arch}).\n` +
        `It ships in the optional dependency "${platformPackageName(target)}",\n` +
        `which package managers install automatically. It can be missing when a\n` +
        `lockfile was created with --omit=optional or on a different platform;\n` +
        `deleting node_modules and your lockfile, then reinstalling, usually\n` +
        `restores the native binary.` +
        (process.platform === 'linux'
          ? `\nNote: prebuilt Linux binaries are glibc-only; Alpine/musl always uses the fallback.`
          : '')
    );
    return;
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
