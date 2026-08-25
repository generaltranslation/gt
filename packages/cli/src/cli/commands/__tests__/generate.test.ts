import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../../types/index.js';

const postProcessTranslations = vi.hoisted(() => vi.fn());

vi.mock('../translate.js', () => ({ postProcessTranslations }));

import { handleGenerate } from '../generate.js';

describe('handleGenerate', () => {
  const originalCwd = process.cwd();
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(path.join(tmpdir(), 'gt-generate-command-'));
    process.chdir(projectDir);
    mkdirSync('messages/en', { recursive: true });
    postProcessTranslations.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(projectDir, { recursive: true, force: true });
  });

  function createSettings(sourceFiles: string[], locales = ['fr']): Settings {
    return {
      defaultLocale: 'en',
      locales,
      files: {
        resolvedPaths: { json: sourceFiles.map((file) => path.resolve(file)) },
        placeholderPaths: {
          json: sourceFiles.map((file) =>
            path.resolve(file.replace('/en/', '/[locale]/'))
          ),
        },
        transformPaths: {},
        transformFormats: {},
      },
      options: {},
    } as Settings;
  }

  it('creates only missing locale files and postprocesses those outputs', async () => {
    writeFileSync('messages/en/common.json', '{"hello":"Hello"}');
    mkdirSync('messages/fr', { recursive: true });
    writeFileSync('messages/fr/common.json', '{"hello":"Bonjour"}');
    const settings = createSettings(['messages/en/common.json'], ['fr', 'es']);

    await handleGenerate(settings);

    expect(readFileSync('messages/fr/common.json', 'utf8')).toBe(
      '{"hello":"Bonjour"}'
    );
    expect(readFileSync('messages/es/common.json', 'utf8')).toBe(
      '{"hello":"Hello"}'
    );
    expect(postProcessTranslations).toHaveBeenCalledWith(
      settings,
      new Set(['messages/es/common.json']),
      { restrictToIncludedFiles: true }
    );
  });

  it('does nothing when every output already exists', async () => {
    writeFileSync('messages/en/common.json', '{"hello":"Hello"}');
    mkdirSync('messages/fr', { recursive: true });
    writeFileSync('messages/fr/common.json', '{"hello":"Bonjour"}');

    await handleGenerate(createSettings(['messages/en/common.json']));

    expect(postProcessTranslations).not.toHaveBeenCalled();
  });

  it('rejects colliding output mappings before writing files', async () => {
    writeFileSync('messages/en/alpha.json', '{"value":"Alpha"}');
    writeFileSync('messages/en/beta.json', '{"value":"Beta"}');
    const settings = createSettings([
      'messages/en/alpha.json',
      'messages/en/beta.json',
    ]);
    settings.files.transformPaths.json = {
      replace: 'messages/fr/common.json',
    };

    await expect(handleGenerate(settings)).rejects.toThrow(
      'Multiple source files map to the same generated output'
    );
    expect(existsSync('messages/fr/common.json')).toBe(false);
  });

  it('rejects format-changing generation without writing its output', async () => {
    writeFileSync('messages/en/messages.pot', 'msgid "Hello"\nmsgstr ""\n');
    const settings = {
      ...createSettings([]),
      files: {
        resolvedPaths: { pot: [path.resolve('messages/en/messages.pot')] },
        placeholderPaths: {
          pot: [path.resolve('messages/[locale]/messages.pot')],
        },
        transformPaths: {},
        transformFormats: { pot: 'PO' },
      },
    } as Settings;

    await expect(handleGenerate(settings)).rejects.toThrow(
      'cannot create templates that change the source file format'
    );
    expect(existsSync('messages/fr/messages.po')).toBe(false);
  });
});
