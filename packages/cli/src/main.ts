#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { main } from './index.js';
import dotenv from 'dotenv';
import { program } from 'commander';

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

function tryExecuteBinary() {
  const binaryName = detectPlatform();

  if (!binaryName) {
    return false;
  }

  const binaryPath = join(__dirname, '..', 'binaries', binaryName);

  if (!existsSync(binaryPath)) {
    return false;
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

  console.log('Binary executed successfully');
  return true;
}

// Try to use standalone binary first, fall back to regular execution
if (!tryExecuteBinary()) {
  dotenv.config({ path: '.env' });
  dotenv.config({ path: '.env.local', override: true });
  dotenv.config({ path: '.env.production', override: true });

  main(program);
  program.parse();
}

export { detectPlatform };
