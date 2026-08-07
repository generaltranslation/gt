import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { Libraries } from '../../types/libraries.js';
import { createOrUpdateConfig } from '../../fs/config/setupConfig.js';
import { createLoadTranslationsFile } from '../../fs/createLoadTranslationsFile.js';
import { createRemoteLoadTranslationsFile } from '../../fs/createRemoteLoadTranslationsFile.js';
import { logger } from '../../console/logger.js';
import { logErrorAndExit, promptSelect } from '../../console/logging.js';
import { getDesiredLocales } from '../../setup/userInput.js';
import { searchForPackageJson } from '../../utils/packageJson.js';
import { VueCLI } from '../vue.js';

vi.mock('../../setup/userInput.js', () => ({
  getDesiredLocales: vi.fn(async () => ({
    defaultLocale: 'en',
    locales: ['fr'],
  })),
}));
vi.mock('../../utils/packageJson.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../utils/packageJson.js')>();
  return {
    ...actual,
    searchForPackageJson: vi.fn(async () => ({
      dependencies: { 'gt-vue': '0.0.0' },
      devDependencies: { gt: '2.16.0' },
    })),
  };
});
vi.mock('../../console/logging.js', () => ({
  displayHeader: vi.fn(),
  exitSync: vi.fn(),
  logErrorAndExit: vi.fn(),
  promptConfirm: vi.fn(),
  promptGlobPatterns: vi.fn(),
  promptMultiSelect: vi.fn(async () => []),
  promptSelect: vi.fn(async () => 'local'),
  promptText: vi.fn(),
}));
vi.mock('../../console/logger.js', () => ({
  logger: {
    endCommand: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
    setQuiet: vi.fn(),
    startCommand: vi.fn(),
    success: vi.fn(),
  },
}));
vi.mock('../../fs/config/setupConfig.js', () => ({
  createOrUpdateConfig: vi.fn(async () => 'gt.config.json'),
}));
vi.mock('../../fs/createLoadTranslationsFile.js', () => ({
  createLoadTranslationsFile: vi.fn(),
}));
vi.mock('../../fs/createRemoteLoadTranslationsFile.js', () => ({
  createRemoteLoadTranslationsFile: vi.fn(),
}));
vi.mock('../../utils/credentials.js', () => ({
  areCredentialsSet: vi.fn(() => true),
  retrieveCredentials: vi.fn(),
  setCredentials: vi.fn(),
}));

class TestVueCLI extends VueCLI {
  runVueInit(useDefaults: boolean): Promise<void> {
    return this.handleInitCommand(true, useDefaults, {
      name: 'vite-vue',
      type: 'vue',
    });
  }

  runNuxtInit(useDefaults: boolean): Promise<void> {
    return this.handleInitCommand(true, useDefaults, {
      name: 'nuxt',
      type: 'vue',
    });
  }

  runExistingVueInit(useDefaults: boolean): Promise<void> {
    return this.handleInitCommand(false, useDefaults, {
      name: 'vite-vue',
      type: 'vue',
    });
  }
}

describe('Vue setup translation loaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(promptSelect).mockResolvedValue('local');
    vi.mocked(searchForPackageJson).mockResolvedValue({
      dependencies: { 'gt-vue': '0.0.0' },
      devDependencies: { gt: '2.16.0' },
    });
  });

  it('stops Nuxt setup before locale prompts or file writes', async () => {
    vi.mocked(logErrorAndExit).mockImplementationOnce((message): never => {
      throw new Error(message);
    });
    const cli = new TestVueCLI(new Command(), Libraries.GT_VUE);

    await expect(cli.runNuxtInit(true)).rejects.toThrow(
      /Automatic gt-vue setup is not available for Nuxt yet/u
    );

    expect(getDesiredLocales).not.toHaveBeenCalled();
    expect(createLoadTranslationsFile).not.toHaveBeenCalled();
    expect(createRemoteLoadTranslationsFile).not.toHaveBeenCalled();
    expect(createOrUpdateConfig).not.toHaveBeenCalled();
  });

  it('creates a local loader and explains createGT wiring with Vue docs', async () => {
    const cli = new TestVueCLI(new Command(), Libraries.GT_VUE);

    await cli.runVueInit(true);

    expect(createLoadTranslationsFile).toHaveBeenCalledWith(
      process.cwd(),
      './src/_gt',
      ['fr']
    );
    expect(createRemoteLoadTranslationsFile).not.toHaveBeenCalled();
    expect(createOrUpdateConfig).toHaveBeenCalledWith(
      'gt.config.json',
      expect.objectContaining({
        files: { gt: { output: 'src/_gt/[locale].json' } },
        framework: 'vite-vue',
        publish: false,
      })
    );
    expect(logger.message).toHaveBeenCalledWith(
      expect.stringContaining('createGT({ loadTranslations })')
    );
    expect(logger.message).toHaveBeenCalledWith(
      expect.stringContaining('generaltranslation.com/docs/vue')
    );
    expect(logger.message).not.toHaveBeenCalledWith(
      expect.stringContaining('/docs/next/')
    );
  });

  it('creates a CDN loader and persists the Vue framework and publish mode', async () => {
    vi.mocked(promptSelect).mockResolvedValue('cdn');
    const cli = new TestVueCLI(new Command(), Libraries.GT_VUE);

    await cli.runVueInit(false);

    expect(createRemoteLoadTranslationsFile).toHaveBeenCalledWith(
      process.cwd()
    );
    expect(createLoadTranslationsFile).not.toHaveBeenCalled();
    expect(createOrUpdateConfig).toHaveBeenCalledWith(
      'gt.config.json',
      expect.objectContaining({
        files: undefined,
        framework: 'vite-vue',
        publish: true,
      })
    );
    expect(logger.message).toHaveBeenCalledWith(
      expect.stringContaining('VITE_GT_PROJECT_ID')
    );
  });

  it.each(['peerDependencies', 'optionalDependencies'] as const)(
    'recognizes an existing gt-vue declaration in %s',
    async (field) => {
      vi.mocked(searchForPackageJson).mockResolvedValue({
        devDependencies: { gt: '2.16.0' },
        [field]: { 'gt-vue': '0.0.0' },
      });
      const cli = new TestVueCLI(new Command(), Libraries.GT_VUE);

      await cli.runExistingVueInit(true);

      expect(createLoadTranslationsFile).toHaveBeenCalledWith(
        process.cwd(),
        './src/_gt',
        ['fr']
      );
    }
  );
});
