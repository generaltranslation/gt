import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createLoadTranslationsFile } from '../createLoadTranslationsFile.js';
import { logger } from '../../console/logger.js';
import {
  DEFAULT_TRANSLATIONS_DIR,
  DEFAULT_VITE_TRANSLATIONS_DIR,
} from '../../utils/constants.js';

describe('createLoadTranslationsFile', () => {
  const tmpDir = path.join(__dirname, '__tmp_test_create_load_translations__');
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    fs.mkdirSync(tmpDir, { recursive: true });
    // The function uses cwd-relative paths for mkdir, so we chdir
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates loadTranslations.js in src/ when src directory exists', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });

    await createLoadTranslationsFile({
      appDirectory: tmpDir,
      translationsDir: DEFAULT_TRANSLATIONS_DIR,
      defaultLocale: 'en',
      locales: ['es', 'fr'],
    });

    const filePath = path.join(tmpDir, 'src', 'loadTranslations.js');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('export default async function loadTranslations');
    expect(content).toContain('import(`../public/_gt/${locale}.json`)');
  });

  it('creates loadTranslations.js at root when no src directory exists', async () => {
    await createLoadTranslationsFile({
      appDirectory: tmpDir,
      translationsDir: DEFAULT_TRANSLATIONS_DIR,
      defaultLocale: 'en',
      locales: ['es'],
    });

    const filePath = path.join(tmpDir, 'loadTranslations.js');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('export default async function loadTranslations');
    expect(content).toContain('import(`./public/_gt/${locale}.json`)');
  });

  it('uses correct relative path for Vite translations dir (./src/_gt)', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });

    await createLoadTranslationsFile({
      appDirectory: tmpDir,
      translationsDir: DEFAULT_VITE_TRANSLATIONS_DIR,
      defaultLocale: 'en',
      locales: ['es'],
    });

    const filePath = path.join(tmpDir, 'src', 'loadTranslations.js');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('import(`./_gt/${locale}.json`)');
    expect(content).not.toContain('public/_gt');
  });

  it('prefixes nested Vite paths with ./ when loadTranslations.js is at the project root', async () => {
    await createLoadTranslationsFile({
      appDirectory: tmpDir,
      translationsDir: DEFAULT_VITE_TRANSLATIONS_DIR,
      defaultLocale: 'en',
      locales: ['es'],
    });

    const filePath = path.join(tmpDir, 'loadTranslations.js');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('import(`./src/_gt/${locale}.json`)');
  });

  it('prefixes hidden relative directories with ./', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });

    await createLoadTranslationsFile({
      appDirectory: tmpDir,
      translationsDir: './src/.gt',
      defaultLocale: 'en',
      locales: ['es'],
    });

    const filePath = path.join(tmpDir, 'src', 'loadTranslations.js');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('import(`./.gt/${locale}.json`)');
  });

  it('creates locale JSON files for non-default locales only', async () => {
    await createLoadTranslationsFile({
      appDirectory: tmpDir,
      translationsDir: DEFAULT_TRANSLATIONS_DIR,
      defaultLocale: 'en',
      locales: ['en', 'es', 'fr'],
    });

    const translationsPath = path.resolve(tmpDir, DEFAULT_TRANSLATIONS_DIR);
    expect(fs.existsSync(path.join(translationsPath, 'es.json'))).toBe(true);
    expect(fs.existsSync(path.join(translationsPath, 'fr.json'))).toBe(true);
    expect(fs.existsSync(path.join(translationsPath, 'en.json'))).toBe(false);

    const content = JSON.parse(
      fs.readFileSync(path.join(translationsPath, 'es.json'), 'utf-8')
    );
    expect(content).toEqual({});
  });

  it('creates locale JSON files in Vite translations directory', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });

    await createLoadTranslationsFile({
      appDirectory: tmpDir,
      translationsDir: DEFAULT_VITE_TRANSLATIONS_DIR,
      defaultLocale: 'en',
      locales: ['es'],
    });

    const translationsPath = path.resolve(
      tmpDir,
      DEFAULT_VITE_TRANSLATIONS_DIR
    );
    expect(fs.existsSync(path.join(translationsPath, 'es.json'))).toBe(true);
  });

  it('creates missing locale files on reruns without changing existing translations or the loader', async () => {
    await createLoadTranslationsFile({
      appDirectory: tmpDir,
      translationsDir: DEFAULT_TRANSLATIONS_DIR,
      defaultLocale: 'en',
      locales: ['es', 'fr'],
    });
    const translationsPath = path.resolve(tmpDir, DEFAULT_TRANSLATIONS_DIR);
    const loaderPath = path.join(tmpDir, 'loadTranslations.js');
    const loader = fs.readFileSync(loaderPath, 'utf8');
    fs.writeFileSync(
      path.join(translationsPath, 'es.json'),
      '{"hello":"hola"}'
    );
    fs.unlinkSync(path.join(translationsPath, 'fr.json'));

    await expect(
      createLoadTranslationsFile({
        appDirectory: tmpDir,
        translationsDir: DEFAULT_TRANSLATIONS_DIR,
        defaultLocale: 'en',
        locales: ['es', 'fr', 'de'],
      })
    ).resolves.toBe('unchanged');

    expect(
      fs.readFileSync(path.join(translationsPath, 'fr.json'), 'utf8')
    ).toBe('{}');
    expect(
      fs.readFileSync(path.join(translationsPath, 'de.json'), 'utf8')
    ).toBe('{}');
    expect(
      fs.readFileSync(path.join(translationsPath, 'es.json'), 'utf8')
    ).toBe('{"hello":"hola"}');
    expect(fs.readFileSync(loaderPath, 'utf8')).toBe(loader);
  });

  it('keeps the loader when a rerun spells the same directory as the config does', async () => {
    await createLoadTranslationsFile({
      appDirectory: tmpDir,
      translationsDir: DEFAULT_TRANSLATIONS_DIR,
      defaultLocale: 'en',
      locales: ['fr'],
    });
    const loaderPath = path.join(tmpDir, 'loadTranslations.js');
    const loader = fs.readFileSync(loaderPath, 'utf8');
    // gt.config.json stores the directory through path.join, without ./
    const configuredDir = path.normalize(DEFAULT_TRANSLATIONS_DIR);

    await expect(
      createLoadTranslationsFile({
        appDirectory: tmpDir,
        translationsDir: configuredDir,
        defaultLocale: 'en',
        locales: ['fr'],
        previousTranslationsDir: configuredDir,
      })
    ).resolves.toBe('unchanged');
    expect(fs.readFileSync(loaderPath, 'utf8')).toBe(loader);
  });

  it.each([
    ['public/old/', 'public/old', 'unchanged'],
    ['./public/old/', 'public/old', 'unchanged'],
    ['public/old/', 'public/new', 'updated'],
    ['./public/old/', 'public/new', 'updated'],
  ])(
    'recognizes legacy directory spelling %s when rerunning with %s',
    async (original, directory, result) => {
      await createLoadTranslationsFile({
        appDirectory: tmpDir,
        translationsDir: original,
        defaultLocale: 'en',
        locales: ['fr'],
      });
      const translatedPath = path.join(tmpDir, 'public/old/fr.json');
      fs.writeFileSync(translatedPath, '{"hello":"bonjour"}');

      await expect(
        createLoadTranslationsFile({
          appDirectory: tmpDir,
          translationsDir: directory,
          defaultLocale: 'en',
          locales: ['fr', 'de'],
          previousTranslationsDir: 'public/old',
        })
      ).resolves.toBe(result);

      expect(
        fs.readFileSync(path.join(tmpDir, directory, 'de.json'), 'utf8')
      ).toBe('{}');
      expect(fs.readFileSync(translatedPath, 'utf8')).toBe(
        '{"hello":"bonjour"}'
      );
      expect(
        fs.readFileSync(path.join(tmpDir, 'loadTranslations.js'), 'utf8')
      ).toContain(`import(\`./${directory}/\${locale}.json\`)`);
    }
  );

  it('does not overwrite existing loadTranslations.js', async () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    const filePath = path.join(tmpDir, 'src', 'loadTranslations.js');
    fs.writeFileSync(filePath, '// custom content');

    await createLoadTranslationsFile({
      appDirectory: tmpDir,
      translationsDir: DEFAULT_TRANSLATIONS_DIR,
      defaultLocale: 'en',
      locales: ['es'],
    });

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toBe('// custom content');
  });

  it.each([
    './public/_gt/${import.meta.env.VITE_BRAND}/',
    './public/_gt/brand/',
  ])(
    'keeps a generated loader whose import path was customized to %s',
    async (importPath) => {
      await createLoadTranslationsFile({
        appDirectory: tmpDir,
        translationsDir: DEFAULT_TRANSLATIONS_DIR,
        defaultLocale: 'en',
        locales: ['es'],
      });
      const filePath = path.join(tmpDir, 'loadTranslations.js');
      const custom = fs
        .readFileSync(filePath, 'utf-8')
        .replace('./public/_gt/', importPath);
      fs.writeFileSync(filePath, custom);

      await expect(
        createLoadTranslationsFile({
          appDirectory: tmpDir,
          translationsDir: 'public/translations',
          defaultLocale: 'en',
          locales: ['es'],
          previousTranslationsDir: DEFAULT_TRANSLATIONS_DIR,
        })
      ).resolves.toBe('custom');
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(custom);
    }
  );

  it.each([DEFAULT_TRANSLATIONS_DIR, undefined])(
    'refreshes a loader only with known previous config: %s',
    async (previousTranslationsDir) => {
      await createLoadTranslationsFile({
        appDirectory: tmpDir,
        translationsDir: DEFAULT_TRANSLATIONS_DIR,
        defaultLocale: 'en',
        locales: ['es'],
      });
      const loaderPath = path.join(tmpDir, 'loadTranslations.js');
      const original = fs.readFileSync(loaderPath, 'utf8');

      const result = await createLoadTranslationsFile({
        appDirectory: tmpDir,
        translationsDir: 'public/new',
        defaultLocale: 'en',
        locales: ['es'],
        previousTranslationsDir,
      });

      expect(result).toBe(previousTranslationsDir ? 'updated' : 'custom');
      const loader = fs.readFileSync(loaderPath, 'utf8');
      if (previousTranslationsDir)
        expect(loader).toContain('import(`./public/new/${locale}.json`)');
      else expect(loader).toBe(original);
    }
  );

  it('does not overwrite existing locale JSON files', async () => {
    const translationsPath = path.resolve(tmpDir, DEFAULT_TRANSLATIONS_DIR);
    fs.mkdirSync(translationsPath, { recursive: true });
    fs.writeFileSync(
      path.join(translationsPath, 'es.json'),
      '{"hello":"hola"}'
    );

    await createLoadTranslationsFile({
      appDirectory: tmpDir,
      translationsDir: DEFAULT_TRANSLATIONS_DIR,
      defaultLocale: 'en',
      locales: ['es'],
    });

    const content = JSON.parse(
      fs.readFileSync(path.join(translationsPath, 'es.json'), 'utf-8')
    );
    expect(content).toEqual({ hello: 'hola' });
  });

  describe('for gt-node', () => {
    const nodeLoader = {
      translationsDir: path.normalize(DEFAULT_TRANSLATIONS_DIR),
      defaultLocale: 'en',
      locales: ['es'],
      runtime: 'node',
    } as const;

    it('writes a loader that Node.js can run', async () => {
      await createLoadTranslationsFile({
        appDirectory: tmpDir,
        ...nodeLoader,
      });
      fs.writeFileSync(
        path.join(tmpDir, 'public/_gt/es.json'),
        '{"a1b2":"Hola"}'
      );

      // Node.js itself loads it, from another directory, as a server would.
      const output = execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          "const { default: load } = await import(process.argv[1]); console.log(JSON.stringify(await load('es')));",
          pathToFileURL(path.join(tmpDir, 'loadTranslations.js')).href,
        ],
        { cwd: os.tmpdir(), encoding: 'utf8' }
      );
      expect(JSON.parse(output)).toEqual({ a1b2: 'Hola' });
    });

    it('keeps a bundler loader on a rerun, which a bundled server can run, and says how to replace it', async () => {
      await createLoadTranslationsFile({
        appDirectory: tmpDir,
        translationsDir: DEFAULT_TRANSLATIONS_DIR,
        defaultLocale: 'en',
        locales: ['es'],
      });
      const loaderPath = path.join(tmpDir, 'loadTranslations.js');
      const loader = fs.readFileSync(loaderPath, 'utf8');
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      await expect(
        createLoadTranslationsFile({
          appDirectory: tmpDir,
          ...nodeLoader,
          previousTranslationsDir: nodeLoader.translationsDir,
        })
      ).resolves.toBe('unchanged');
      expect(fs.readFileSync(loaderPath, 'utf8')).toBe(loader);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('without an import attribute')
      );
      warn.mockRestore();
    });

    it('keeps each loader runtime when the directory changes', async () => {
      const loaderPath = path.join(tmpDir, 'loadTranslations.js');
      for (const runtime of ['bundler', 'node'] as const) {
        fs.rmSync(loaderPath, { force: true });
        await createLoadTranslationsFile({
          appDirectory: tmpDir,
          ...nodeLoader,
          runtime,
        });
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        await expect(
          createLoadTranslationsFile({
            appDirectory: tmpDir,
            ...nodeLoader,
            translationsDir: 'translations',
            previousTranslationsDir: nodeLoader.translationsDir,
          })
        ).resolves.toBe('updated');
        const loader = fs.readFileSync(loaderPath, 'utf8');
        expect(loader).toContain('./translations/${locale}.json');
        expect(loader.includes('readFile')).toBe(runtime === 'node');
        warn.mockRestore();
      }
    });

    it('leaves an edited loader unchanged', async () => {
      const loaderPath = path.join(tmpDir, 'loadTranslations.js');
      const edited = `export default async function loadTranslations(locale) {
  return (await import(\`./public/_gt/\${locale}.json\`, { with: { type: 'json' } })).default;
}
`;
      fs.writeFileSync(loaderPath, edited);

      await expect(
        createLoadTranslationsFile({
          appDirectory: tmpDir,
          ...nodeLoader,
          previousTranslationsDir: nodeLoader.translationsDir,
        })
      ).resolves.toBe('custom');
      expect(fs.readFileSync(loaderPath, 'utf8')).toBe(edited);
    });
  });

  it('defaults to ./public/_gt when no translationsDir is provided', async () => {
    await createLoadTranslationsFile({
      appDirectory: tmpDir,
      defaultLocale: 'en',
      locales: ['es'],
    });

    const filePath = path.join(tmpDir, 'loadTranslations.js');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('import(`./public/_gt/${locale}.json`)');
  });
});
