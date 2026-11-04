import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const spawnSpy = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawn: (...args: Parameters<typeof actual.spawn>) => {
      spawnSpy(...args);
      return actual.spawn(...args);
    },
  };
});

vi.mock('../../console/logger.js', () => ({
  logger: { warn: vi.fn(), message: vi.fn() },
}));

import { logger } from '../../console/logger.js';
import { findLocalBiome, formatFiles } from '../postProcess.js';

let root: string;
let originalCwd: string;

/** Installs a fake Biome entry point that marks each file it formats. */
function installFakeBiome(dir: string) {
  const bin = path.join(
    dir,
    'node_modules',
    '@biomejs',
    'biome',
    'bin',
    'biome'
  );
  fs.mkdirSync(path.dirname(bin), { recursive: true });
  // Not executable and no shebang: it must run through Node, as on Windows.
  fs.writeFileSync(
    bin,
    `const fs = require('node:fs');
for (const a of process.argv.slice(4)) fs.appendFileSync(a, '// biome\\n');
`
  );
  return bin;
}

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gt-biome-')));
  originalCwd = process.cwd();
  spawnSpy.mockClear();
  vi.mocked(logger.warn).mockClear();
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(root, { recursive: true, force: true });
});

describe('findLocalBiome', () => {
  it('returns null when Biome is not installed', () => {
    expect(findLocalBiome(root)).toBeNull();
    expect(spawnSpy).not.toHaveBeenCalled();
  });

  it('finds Biome installed in the project', () => {
    const bin = installFakeBiome(root);
    expect(findLocalBiome(root)).toBe(bin);
  });

  it('finds Biome installed at a monorepo root', () => {
    const bin = installFakeBiome(root);
    const app = path.join(root, 'apps', 'web');
    fs.mkdirSync(app, { recursive: true });
    expect(findLocalBiome(app)).toBe(bin);
  });
});

describe('formatFiles with biome', () => {
  it('runs the project’s Biome with Node instead of npx', async () => {
    const bin = installFakeBiome(root);
    const file = path.join(root, 'page.tsx');
    fs.writeFileSync(file, 'export {};\n');
    process.chdir(root);

    await formatFiles([file], 'biome');

    expect(spawnSpy).toHaveBeenCalledTimes(1);
    expect(spawnSpy.mock.calls[0][0]).toBe(process.execPath);
    expect(spawnSpy.mock.calls[0][1]).toEqual([bin, 'format', '--write', file]);
    expect(fs.readFileSync(file, 'utf-8')).toBe('export {};\n// biome\n');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns and skips formatting when Biome is not installed', async () => {
    const file = path.join(root, 'page.tsx');
    fs.writeFileSync(file, 'export {};\n');
    process.chdir(root);

    await formatFiles([file], 'biome');

    expect(spawnSpy).not.toHaveBeenCalled();
    expect(fs.readFileSync(file, 'utf-8')).toBe('export {};\n');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('@biomejs/biome is not installed')
    );
  });
});
