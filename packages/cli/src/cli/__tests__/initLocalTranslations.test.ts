import { Command } from 'commander';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLoadTranslationsFile } from '../../fs/createLoadTranslationsFile.js';
import { BaseCLI } from '../base.js';

vi.mock('../../console/logging.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../console/logging.js')>()),
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
  runInit() {
    return this.handleInitCommand(true);
  }
}

describe('init local translations', () => {
  let appDirectory: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    appDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-init-local-'));
    process.chdir(appDirectory);
    fs.writeFileSync('package.json', '{"name":"app"}');
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
