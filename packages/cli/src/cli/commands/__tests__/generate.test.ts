import fs, {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
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

  it('preserves a concurrently replaced output during rollback', async () => {
    writeFileSync('messages/en/common.json', '{"hello":"Hello"}');
    const settings = createSettings(['messages/en/common.json']);
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    postProcessTranslations.mockImplementationOnce(async () => {
      writeFileSync('messages/fr/replacement.json', '{"hello":"User edit"}');
      rmSync('messages/fr/common.json');
      renameSync('messages/fr/replacement.json', 'messages/fr/common.json');
      throw new Error('Postprocessing failed');
    });

    await expect(handleGenerate(settings)).rejects.toThrow(
      'Postprocessing failed'
    );

    expect(readFileSync('messages/fr/common.json', 'utf8')).toBe(
      '{"hello":"User edit"}'
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('file changed'));
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
    const removeFile = fs.promises.rm.bind(fs.promises);
    const remove = vi
      .spyOn(fs.promises, 'rm')
      .mockImplementation(async (filePath, options) => {
        if (filePath === path.resolve('messages/fr/alpha.json')) {
          throw new Error('Cleanup failed');
        }
        await removeFile(filePath, options);
      });
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

  it('rejects filesystem aliases to a pre-existing output', async () => {
    mkdirSync('sources/en', { recursive: true });
    mkdirSync('messages/fr', { recursive: true });
    writeFileSync('sources/en/alpha.json', '{"value":"Alpha"}');
    writeFileSync('sources/en/beta.json', '{"value":"Beta"}');
    writeFileSync('messages/fr/common.json', '{"value":"Existing"}');
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

    expect(readFileSync('messages/fr/common.json', 'utf8')).toBe(
      '{"value":"Existing"}'
    );
    expect(postProcessTranslations).not.toHaveBeenCalled();
  });

  it('rejects an existing output path that is not a regular file', async () => {
    writeFileSync('messages/en/common.json', '{"value":"Hello"}');
    mkdirSync('messages/fr/common.json', { recursive: true });

    await expect(
      handleGenerate(createSettings(['messages/en/common.json']))
    ).rejects.toThrow('generated output path is not a regular file');

    expect(postProcessTranslations).not.toHaveBeenCalled();
  });

  it('checks each generated output identity once', async () => {
    const sourceFiles = ['alpha', 'beta', 'gamma'].map((name) => {
      const filePath = `messages/en/${name}.json`;
      writeFileSync(filePath, `{"value":"${name}"}`);
      return filePath;
    });
    const stat = vi.spyOn(fs.promises, 'stat');

    await handleGenerate(createSettings(sourceFiles));

    expect(stat).toHaveBeenCalledTimes(sourceFiles.length);
  });

  it('rejects file format conversion before writing templates', async () => {
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
    expect(postProcessTranslations).not.toHaveBeenCalled();
  });

  it('ignores format conversion rules with no matching source files', async () => {
    writeFileSync('messages/en/common.json', '{"value":"Hello"}');
    const settings = createSettings(['messages/en/common.json']);
    settings.files.resolvedPaths.pot = [];
    settings.files.placeholderPaths.pot = [];
    settings.files.transformFormats.pot = 'PO';

    await handleGenerate(settings);

    expect(readFileSync('messages/fr/common.json', 'utf8')).toBe(
      '{"value":"Hello"}'
    );
  });

  it('preserves an existing converted output without parsing its source', async () => {
    mkdirSync('messages/fr', { recursive: true });
    writeFileSync('messages/en/messages.pot', 'not valid gettext');
    writeFileSync('messages/fr/messages.po', 'existing translation');
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

    await handleGenerate(settings);

    expect(readFileSync('messages/fr/messages.po', 'utf8')).toBe(
      'existing translation'
    );
    expect(postProcessTranslations).not.toHaveBeenCalled();
  });

  it('preserves existing outputs without parsing schema sources', async () => {
    mkdirSync('content/en', { recursive: true });
    mkdirSync('content/fr', { recursive: true });
    writeFileSync('content/en/config.json', 'not valid json');
    writeFileSync('content/fr/config.json', '{"title":"Existing"}');
    const settings = {
      ...createSettings([]),
      files: {
        resolvedPaths: { json: [path.resolve('content/en/config.json')] },
        placeholderPaths: {
          json: [path.resolve('content/[locale]/config.json')],
        },
        transformPaths: {},
        transformFormats: {},
      },
      options: {
        jsonSchema: { 'content/**/*.json': { include: ['$..title'] } },
      },
    } as Settings;

    await handleGenerate(settings);

    expect(readFileSync('content/fr/config.json', 'utf8')).toBe(
      '{"title":"Existing"}'
    );
    expect(postProcessTranslations).not.toHaveBeenCalled();
  });

  it('applies schema transformations when creating YAML templates', async () => {
    mkdirSync('content/en', { recursive: true });
    writeFileSync(
      'content/en/navigation.yaml',
      'title: Hello\nroute: /en/guide\n'
    );
    const settings = {
      ...createSettings([]),
      files: {
        resolvedPaths: {
          yaml: [path.resolve('content/en/navigation.yaml')],
        },
        placeholderPaths: {
          yaml: [path.resolve('content/[locale]/navigation.yaml')],
        },
        transformPaths: {},
        transformFormats: {},
      },
      options: {
        yamlSchema: {
          'content/**/*.yaml': {
            include: ['$.title'],
            transform: {
              '$.route': { match: '^/{locale}/', replace: '/{locale}/' },
            },
          },
        },
      },
    } as Settings;

    await handleGenerate(settings);

    expect(readFileSync('content/fr/navigation.yaml', 'utf8')).toContain(
      'route: /fr/guide'
    );
    expect(readFileSync('content/en/navigation.yaml', 'utf8')).toContain(
      'route: /en/guide'
    );
  });

  it('resolves JSON references when creating schema templates', async () => {
    mkdirSync('content/en', { recursive: true });
    writeFileSync('content/en/shared.json', '{"title":"Hello"}');
    writeFileSync('content/en/config.json', '{"$ref":"./shared.json"}');
    const settings = {
      ...createSettings([]),
      files: {
        resolvedPaths: { json: [path.resolve('content/en/config.json')] },
        placeholderPaths: {
          json: [path.resolve('content/[locale]/config.json')],
        },
        transformPaths: {},
        transformFormats: {},
      },
      options: {
        jsonSchema: {
          'content/**/config.json': {
            include: ['$..title'],
            resolveRefs: true,
          },
        },
      },
    } as Settings;

    await handleGenerate(settings);

    expect(JSON.parse(readFileSync('content/fr/config.json', 'utf8'))).toEqual({
      title: 'Hello',
    });
  });

  it('seeds target entries for composite JSON templates', async () => {
    mkdirSync('content/en', { recursive: true });
    writeFileSync(
      'content/en/navigation.json',
      JSON.stringify({
        navigation: {
          languages: [{ language: 'en', label: 'Documentation' }],
        },
      })
    );
    const settings = {
      ...createSettings([]),
      files: {
        resolvedPaths: {
          json: [path.resolve('content/en/navigation.json')],
        },
        placeholderPaths: {
          json: [path.resolve('content/[locale]/navigation.json')],
        },
        transformPaths: {},
        transformFormats: {},
      },
      options: {
        jsonSchema: {
          'content/**/navigation.json': {
            composite: {
              '$.navigation.languages': {
                type: 'array',
                key: '$.language',
                include: ['$.label'],
              },
            },
          },
        },
      },
    } as Settings;

    await handleGenerate(settings);

    const generated = JSON.parse(
      readFileSync('content/fr/navigation.json', 'utf8')
    ) as { navigation: { languages: { language: string; label: string }[] } };
    expect(
      generated.navigation.languages.find(({ language }) => language === 'fr')
    ).toEqual({ language: 'fr', label: 'Documentation' });
  });
});
