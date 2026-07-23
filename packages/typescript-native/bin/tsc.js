#!/usr/bin/env node

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve('@typescript/native/package.json');
const compilerPath = join(dirname(packageJsonPath), 'lib', 'tsc.js');

await import(pathToFileURL(compilerPath).href);
