#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

// Restore original version (remove -bin.0 suffix)
const originalVersion = packageJson.version.replace(/-bin\.0$/, '');

// Restore package.json fields
packageJson.version = originalVersion;
packageJson.bin = 'dist/router.js';

// Write restored package.json
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

console.log(`Restored package.json: ${packageJson.version} with bin: ${packageJson.bin}`);