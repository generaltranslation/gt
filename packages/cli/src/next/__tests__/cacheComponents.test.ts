import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  hasCustomGetLocale,
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

describe('hasCustomGetLocale', () => {
  it.each([
    ['in the project root', 'getLocale.ts', true],
    ['in src', 'src/getLocale.js', true],
    ['missing', 'getRegion.ts', false],
    ['nested elsewhere', 'lib/getLocale.ts', false],
  ])('%s', (_name, file, expected) => {
    write(file);
    expect(hasCustomGetLocale(cwd)).toBe(expected);
  });
});
