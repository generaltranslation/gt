import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ResolvedConfig } from 'vite';
import { afterEach, expect, it, vi } from 'vitest';
import { gtTanstackStart } from '../vite';

// The compiler is an optional peer dependency; simulate an app without it.
vi.mock('node:module', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:module')>()),
  createRequire: () => () => {
    throw new Error("Cannot find module '@generaltranslation/compiler'");
  },
}));

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

it('skips the GT compiler and warns when it is not installed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-tanstack-start-'));
  tempDirs.push(root);
  const config = path.join(root, 'gt.config.json');
  fs.writeFileSync(config, JSON.stringify({ defaultLocale: 'en' }));

  const plugins = gtTanstackStart({
    config,
    experimentalCompilerOptions: { type: 'babel' },
  });

  expect(plugins.map((plugin) => plugin.name)).toEqual(['gt-tanstack-start']);
  const warnOnce = vi.fn();
  const configResolved = plugins[0].configResolved;
  if (typeof configResolved !== 'function') {
    throw new Error('Expected a configResolved hook');
  }
  configResolved.call(
    {} as ThisParameterType<typeof configResolved>,
    { root, plugins, logger: { warnOnce } } as unknown as ResolvedConfig
  );
  expect(warnOnce).toHaveBeenCalledWith(
    expect.stringContaining('The GT babel compiler could not be resolved')
  );
});
