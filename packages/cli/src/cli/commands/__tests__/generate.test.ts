import fs, {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../../types/index.js';
import { logger } from '../../../console/logger.js';

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
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    rmSync(projectDir, { recursive: true, force: true });
  });

  function createSettings(sourceFiles: string[]): Settings {
    return {
      defaultLocale: 'en',
      locales: ['fr'],
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

  it('removes generated files when postprocessing fails so a retry can finish', async () => {
    writeFileSync('messages/en/common.json', '{"hello":"Hello"}');
    const settings = createSettings(['messages/en/common.json']);
    postProcessTranslations.mockRejectedValueOnce(
      new Error('Postprocessing failed')
    );

    await expect(handleGenerate(settings)).rejects.toThrow(
      'Postprocessing failed'
    );
    expect(existsSync('messages/fr/common.json')).toBe(false);

    await handleGenerate(settings);

    expect(readFileSync('messages/fr/common.json', 'utf8')).toBe(
      '{"hello":"Hello"}'
    );
    expect(postProcessTranslations).toHaveBeenCalledTimes(2);
    expect(postProcessTranslations).toHaveBeenLastCalledWith(
      settings,
      new Set(['messages/fr/common.json']),
      { restrictToIncludedFiles: true }
    );
  });

  it('attempts every rollback while preserving the generation error', async () => {
    writeFileSync('messages/en/alpha.json', '{"value":"Alpha"}');
    writeFileSync('messages/en/beta.json', '{"value":"Beta"}');
    const settings = createSettings([
      'messages/en/alpha.json',
      'messages/en/beta.json',
    ]);
    postProcessTranslations.mockRejectedValueOnce(
      new Error('Postprocessing failed')
    );
    const remove = vi
      .spyOn(fs.promises, 'rm')
      .mockRejectedValueOnce(new Error('Cleanup failed'));
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    await expect(handleGenerate(settings)).rejects.toThrow(
      'Postprocessing failed'
    );

    expect(remove).toHaveBeenCalledTimes(2);
    expect(existsSync('messages/fr/alpha.json')).toBe(true);
    expect(existsSync('messages/fr/beta.json')).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('could not be removed')
    );
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
    expect(postProcessTranslations).not.toHaveBeenCalled();
  });

  it('rejects filesystem-equivalent output mappings', async () => {
    mkdirSync('sources/en', { recursive: true });
    writeFileSync('sources/en/alpha.json', '{"value":"Alpha"}');
    writeFileSync('sources/en/beta.json', '{"value":"Beta"}');
    symlinkSync(
      path.resolve('messages'),
      'messages-alias',
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    const settings = createSettings([
      'sources/en/alpha.json',
      'sources/en/beta.json',
    ]);
    settings.files.placeholderPaths.json = [
      path.resolve('messages/[locale]/common.json'),
      path.resolve('messages-alias/[locale]/common.json'),
    ];

    await expect(handleGenerate(settings)).rejects.toThrow(
      'Multiple source files map to the same generated output'
    );

    expect(existsSync('messages/fr/common.json')).toBe(false);
    expect(postProcessTranslations).not.toHaveBeenCalled();
  });
});
