#!/usr/bin/env node

// Routes to proper binary based on platform

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, chmodSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function detectPlatform() {
  const platform = process.platform;
  const arch = process.arch;

  // Map Node.js platform/arch to our binary names
  const platformMap: Record<string, Record<string, string>> = {
    darwin: {
      x64: 'gtx-cli-darwin-x64',
      arm64: 'gtx-cli-darwin-arm64',
    },
    linux: {
      x64: 'gtx-cli-linux-x64',
      arm64: 'gtx-cli-linux-arm64',
    },
    win32: {
      x64: 'gtx-cli-win32-x64.exe',
    },
  };

  return platformMap[platform]?.[arch] || null;
}

function routeToBinary(): void {
  const binaryName = detectPlatform();

  if (!binaryName) {
    return;
  }

  const binaryPath = join(__dirname, '..', 'binaries', binaryName);

  if (!existsSync(binaryPath)) {
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
    } catch (error) {
      // If we can't check/fix permissions, continue anyway
      // The spawn might still work or give a more meaningful error
    }
  }

  // Spawn the appropriate binary with all arguments
  const child = spawn(binaryPath, process.argv.slice(2), {
    stdio: 'inherit',
  });

  child.on('close', (code) => {
    process.exit(code);
  });

  child.on('error', () => {
    process.exit(1);
  });

  return;
}

// Entry point
routeToBinary();
