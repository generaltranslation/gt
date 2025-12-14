#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

// Generate TypeScript file content
const tsContent = `// This file is auto-generated. Do not edit manually.
export const PACKAGE_VERSION = '${packageJson.version}';
`;

// Write to src/generated/version.ts
const outputPath = join(__dirname, '..', 'src', 'generated', 'version.ts');
writeFileSync(outputPath, tsContent, 'utf8');
