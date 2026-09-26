import { Command } from 'commander';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLoadTranslationsFile } from '../../fs/createLoadTranslationsFile.js';
import { BaseCLI } from '../base.js';
import { promptMultiSelect } from '../../console/logging.js';
import { setupViteSPA } from '../../setup/setupViteSPA.js';

vi.mock('../../console/logging.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../console/logging.js')>()),
  promptConfirm: vi.fn(async () => false),
  promptSelect: vi.fn(async () => 'local'),
  promptText: vi.fn(async () => 'public/new'),
  promptMultiSelect: vi.fn(async () => {
    throw new Error('cancelled');
  }),
}));

vi.mock('../../setup/userInput.js', () => ({
  getDesiredLocales: vi.fn(async () => ({
    defaultLocale: 'en',
    locales: ['fr'],
  })),
}));

class InitCLI extends BaseCLI {
  runInit(isVite = false) {
    return this.handleInitCommand(true, false, isVite);
  }
}

describe('init local translations', () => {
  let appDirectory: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    appDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-init-local-'));
    process.chdir(appDirectory);
    fs.writeFileSync(
      'package.json',
      '{"name":"app","devDependencies":{"gt":"*"}}'
    );
    fs.writeFileSync(
      'gt.config.json',
      JSON.stringify({ files: { gt: { output: 'public/old/[locale].json' } } })
    );
    await createLoadTranslationsFile(appDirectory, 'public/old', ['fr']);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(appDirectory, { recursive: true, force: true });
  });

  it.each([false, true])(
    'uses the config before updating it to refresh the loader (Vite: %s)',
    async (isVite) => {
      const loaderPath = isVite
        ? 'src/loadTranslations.ts'
        : 'loadTranslations.js';
      if (isVite) {
        fs.mkdirSync('src');
        fs.writeFileSync('src/main.tsx', '// app');
        fs.writeFileSync(
          'index.html',
          '<script type="module" src="/src/main.tsx"></script>'
        );
        await setupViteSPA({
          appDirectory,
          configFilepath: 'gt.config.json',
          defaultLocale: 'en',
          locales: ['fr'],
          translationsDir: 'public/old',
        });
      } else {
        fs.unlinkSync(loaderPath);
        await createLoadTranslationsFile(appDirectory, './public/old', ['fr']);
      }
      vi.mocked(promptMultiSelect).mockResolvedValueOnce([]);

      await new InitCLI(new Command(), 'gt-react').runInit(isVite);

      expect(fs.readFileSync(loaderPath, 'utf8')).toContain(
        'public/new/${locale}.json'
      );
      expect(
        JSON.parse(fs.readFileSync('gt.config.json', 'utf8')).files.gt.output
      ).toBe('public/new/[locale].json');
    }
  );

  it('keeps the loader and config in sync when a later prompt is cancelled', async () => {
    const loader = fs.readFileSync('loadTranslations.js', 'utf8');
    const config = fs.readFileSync('gt.config.json', 'utf8');

    await expect(
      new InitCLI(new Command(), 'gt-react').runInit()
    ).rejects.toThrow('cancelled');

    expect(fs.readFileSync('loadTranslations.js', 'utf8')).toBe(loader);
    expect(fs.readFileSync('gt.config.json', 'utf8')).toBe(config);
  });
});
