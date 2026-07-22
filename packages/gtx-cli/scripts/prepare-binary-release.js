#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  TARGETS,
  platformPackageName,
} from '../../../scripts/platform-packages.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

// Modify version to add -bin.0 suffix
const originalVersion = packageJson.version;
const binaryVersion = `${originalVersion}-bin.0`;

// Modify package.json for binary release
packageJson.version = binaryVersion;
packageJson.bin = 'dist/bin/bin-main.js';

// Pin the per-platform binary packages to this exact release
packageJson.optionalDependencies = {
  ...packageJson.optionalDependencies,
  ...Object.fromEntries(
    TARGETS.map((entry) => [
      platformPackageName(packageJson.name, entry.target),
      originalVersion,
    ])
  ),
};

// Write modified package.json
writeFileSync(
  packageJsonPath,
  JSON.stringify(packageJson, null, 2) + '\n',
  'utf8'
);
