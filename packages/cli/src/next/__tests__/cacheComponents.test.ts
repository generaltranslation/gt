import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  hasCustomRequestFunctions,
  isCacheComponentsEnabled,
} from '../cacheComponents.js';

let cwd: string;

function write(file: string, content = '') {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), content);
}

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-cache-components-'));
});

afterEach(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
});

describe('isCacheComponentsEnabled', () => {
  it.each([
    ['top-level', 'export default { cacheComponents: true };', true],
    [
      'typed config',
      "import type { NextConfig } from 'next';\nconst nextConfig: NextConfig = { cacheComponents: true };\nexport default nextConfig;",
      true,
    ],
    ['CommonJS', 'module.exports = { "cacheComponents": true };', true],
    [
      'a named value',
      'const cacheComponents = true;\nexport default { cacheComponents };',
      true,
    ],
    [
      'an environment check',
      "export default { cacheComponents: process.env.CC === '1' };",
      true,
    ],
    ['disabled', 'export default { cacheComponents: false };', false],
    ['missing', 'export default {};', false],
    ['unparsable', 'export default {', false],
  ])('%s', (_name, code, expected) => {
    write('next.config.ts', code);
    expect(isCacheComponentsEnabled(path.join(cwd, 'next.config.ts'))).toBe(
      expected
    );
  });
});

describe('hasCustomRequestFunctions', () => {
  it.each([
    ['both in the project root', ['getLocale.ts', 'getRegion.ts'], true],
    ['both in src', ['src/getLocale.js', 'src/getRegion.js'], true],
    ['split across root and src', ['getLocale.ts', 'src/getRegion.ts'], true],
    ['only getLocale', ['getLocale.ts'], false],
    ['only getRegion', ['src/getRegion.ts'], false],
    ['extensions gt-next ignores', ['getLocale.mjs', 'getRegion.tsx'], false],
    ['nested elsewhere', ['lib/getLocale.ts', 'lib/getRegion.ts'], false],
  ])('%s', (_name, files, expected) => {
    files.forEach((file) => write(file));
    expect(hasCustomRequestFunctions(cwd)).toBe(expected);
  });
});
