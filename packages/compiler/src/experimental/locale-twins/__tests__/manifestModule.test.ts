import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LOCALE_TWIN_MANIFEST_FILE,
  type LocaleTwinManifest,
} from 'generaltranslation/internal/experimental';
import { loadManifestModule } from '../vite/manifestModule';

const MANIFEST: LocaleTwinManifest = {
  version: 1,
  defaultLocale: 'en',
  locales: ['en'],
  twinned: [],
  entries: [],
  versions: { en: '11111111' },
  twins: { en: {} },
};

describe('virtual:gt-locale-twins-manifest', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-manifest-module-'));
    fs.mkdirSync(path.join(root, 'dist/client'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'dist/client', LOCALE_TWIN_MANIFEST_FILE),
      JSON.stringify(MANIFEST)
    );
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function load(command: 'build' | 'serve') {
    return loadManifestModule({
      enabled: true,
      consumer: 'server',
      config: { root, command, build: { outDir: 'dist/client' } },
    });
  }

  it("gives a server build the client build's manifest", () => {
    expect(load('build')).toEqual({
      code: `export const manifest = ${JSON.stringify(MANIFEST)};\n`,
      manifestPath: path.join(root, 'dist/client', LOCALE_TWIN_MANIFEST_FILE),
    });
  });

  // vite dev serves no twins: a manifest left by an earlier build is stale
  it('ignores a manifest left in the outDir by an earlier build in vite dev', () => {
    expect(load('serve')).toEqual({ code: 'export const manifest = null;\n' });
  });
});
