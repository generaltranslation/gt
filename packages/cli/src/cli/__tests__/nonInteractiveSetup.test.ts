import { Command } from 'commander';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logErrorAndExit } from '../../console/logging.js';
import { retrieveCredentials } from '../../utils/credentials.js';
import { installPackage } from '../../utils/installPackage.js';
import { BaseCLI } from '../base.js';

vi.mock('../../console/logging.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../console/logging.js')>();
  const rejectPrompt = vi.fn(() => {
    throw new Error('unexpected prompt');
  });
  return {
    ...actual,
    logErrorAndExit: vi.fn((message: string) => {
      throw new Error(message);
    }),
    promptText: rejectPrompt,
    promptLocale: rejectPrompt,
    promptLocaleList: rejectPrompt,
    promptGlobPatterns: rejectPrompt,
    promptSelect: rejectPrompt,
    promptMultiSelect: rejectPrompt,
    promptConfirm: rejectPrompt,
  };
});

vi.mock('../../utils/credentials.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../utils/credentials.js')>();
  return {
    ...actual,
    retrieveCredentials: vi.fn(() => {
      throw new Error('unexpected browser login');
    }),
  };
});

vi.mock('../../utils/installPackage.js', () => ({
  installPackage: vi.fn(() => Promise.resolve()),
}));

function runCommand(args: string[]) {
  const program = new Command();
  program.exitOverride();
  new BaseCLI(program, 'base');
  return program.parseAsync(args, { from: 'user' });
}

function readConfig(dir: string) {
  return JSON.parse(readFileSync(path.join(dir, 'gt.config.json'), 'utf8'));
}

describe('non-interactive init and configure', () => {
  let projectDir: string;
  let originalCwd: string;
  const originalIsTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');

  beforeEach(() => {
    vi.clearAllMocks();
    delete (
      global as typeof global & {
        _gt_wizard_cached_package_manager?: unknown;
      }
    )._gt_wizard_cached_package_manager;
    vi.stubEnv('GT_PROJECT_ID', '');
    vi.stubEnv('GT_API_KEY', '');
    vi.stubEnv('GT_DEV_API_KEY', '');
    Object.defineProperty(process.stdin, 'isTTY', {
      value: undefined,
      configurable: true,
    });
    originalCwd = process.cwd();
    projectDir = mkdtempSync(path.join(tmpdir(), 'gt-noninteractive-'));
    process.chdir(projectDir);
    writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify({ name: 'example-app', devDependencies: { gt: '1.0.0' } })
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalIsTTY) {
      Object.defineProperty(process.stdin, 'isTTY', originalIsTTY);
    }
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(projectDir, { recursive: true, force: true });
  });

  it.each(['init', 'configure'])(
    'exits nonzero from %s when stdin is not a TTY',
    async (command) => {
      await expect(runCommand([command])).rejects.toThrow('--yes');

      expect(logErrorAndExit).toHaveBeenCalledWith(
        expect.stringContaining('--yes')
      );
      expect(existsSync(path.join(projectDir, 'gt.config.json'))).toBe(false);
    }
  );

  it('completes init --yes without prompts when locales are configured', async () => {
    writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify({
        name: 'example-app',
        dependencies: { 'gt-next': '1.0.0' },
        devDependencies: { gt: '1.0.0' },
      })
    );
    writeFileSync(
      path.join(projectDir, 'gt.config.json'),
      JSON.stringify({ defaultLocale: 'en', locales: ['es', 'fr'] })
    );

    await runCommand(['init', '--yes']);

    const config = readConfig(projectDir);
    expect(config.defaultLocale).toBe('en');
    expect(config.locales).toEqual(['es', 'fr']);
    expect(config.files.gt.output).toContain('[locale].json');
    expect(existsSync(path.join(projectDir, 'loadTranslations.js'))).toBe(true);
    expect(retrieveCredentials).not.toHaveBeenCalled();
  });

  it('completes configure --yes when locales and files are configured', async () => {
    const seededFiles = {
      json: { include: ['./content/[locale]/*.json'] },
    };
    writeFileSync(
      path.join(projectDir, 'gt.config.json'),
      JSON.stringify({
        defaultLocale: 'en',
        locales: ['es'],
        files: seededFiles,
      })
    );

    await runCommand(['configure', '--yes']);

    const config = readConfig(projectDir);
    expect(config.defaultLocale).toBe('en');
    expect(config.locales).toEqual(['es']);
    expect(config.files).toEqual(seededFiles);
    expect(retrieveCredentials).not.toHaveBeenCalled();
  });

  it('fails init --yes when no locales are configured', async () => {
    await expect(runCommand(['init', '--yes'])).rejects.toThrow('locales');

    expect(logErrorAndExit).toHaveBeenCalledWith(
      expect.stringContaining('gt.config.json')
    );
    expect(existsSync(path.join(projectDir, 'gt.config.json'))).toBe(false);
  });

  it('defaults to npm for the gt install when no package manager is detectable', async () => {
    writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify({ name: 'example-app' })
    );
    const seededFiles = {
      json: { include: ['./content/[locale]/*.json'] },
    };
    writeFileSync(
      path.join(projectDir, 'gt.config.json'),
      JSON.stringify({
        defaultLocale: 'en',
        locales: ['es'],
        files: seededFiles,
      })
    );

    await runCommand(['configure', '--yes']);

    expect(installPackage).toHaveBeenCalledWith(
      'gt',
      expect.objectContaining({ id: 'npm' }),
      true
    );
    expect(readConfig(projectDir).files).toEqual(seededFiles);
  });

  it('fails init --yes when a project without a GT library has no files entry', async () => {
    const seededConfig = { defaultLocale: 'en', locales: ['es'] };
    writeFileSync(
      path.join(projectDir, 'gt.config.json'),
      JSON.stringify(seededConfig)
    );

    await expect(runCommand(['init', '--yes'])).rejects.toThrow('files');

    expect(readConfig(projectDir)).toEqual(seededConfig);
  });
});
