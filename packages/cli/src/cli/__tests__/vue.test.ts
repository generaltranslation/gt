import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setupMocks = vi.hoisted(() => ({
  areCredentialsSet: vi.fn(),
  createOrUpdateConfig: vi.fn(),
  getDesiredLocales: vi.fn(),
  promptMultiSelect: vi.fn(),
  searchForPackageJson: vi.fn(),
}));

vi.mock('../../utils/packageJson.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../utils/packageJson.js')>();
  return {
    ...actual,
    searchForPackageJson: setupMocks.searchForPackageJson,
  };
});

vi.mock('../../fs/config/setupConfig.js', () => ({
  createOrUpdateConfig: setupMocks.createOrUpdateConfig,
}));

vi.mock('../../setup/userInput.js', () => ({
  getDesiredLocales: setupMocks.getDesiredLocales,
}));

vi.mock('../../utils/credentials.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../utils/credentials.js')>();
  return {
    ...actual,
    areCredentialsSet: setupMocks.areCredentialsSet,
  };
});

vi.mock('../../console/logging.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../console/logging.js')>();
  return {
    ...actual,
    promptMultiSelect: setupMocks.promptMultiSelect,
  };
});

import { VueCLI } from '../vue.js';

function withInstalledCLI(
  manifest: Record<string, unknown>
): Record<string, unknown> {
  const devDependencies =
    manifest.devDependencies !== null &&
    typeof manifest.devDependencies === 'object' &&
    !Array.isArray(manifest.devDependencies)
      ? (manifest.devDependencies as Record<string, unknown>)
      : {};
  return {
    ...manifest,
    devDependencies: { gt: '*', ...devDependencies },
  };
}

class TestVueCLI extends VueCLI {
  public readonly configure = vi.fn(
    async (_useBundledDefaults: boolean) => undefined
  );

  protected override handleConfigureCommand(
    useBundledTranslationDefaults: boolean = true
  ): Promise<void> {
    return this.configure(useBundledTranslationDefaults);
  }

  public detectsInstalledInlineRuntime(
    packageJson: Record<string, unknown>
  ): boolean {
    return this.hasInstalledInlineRuntime(packageJson);
  }

  public runSetupWithDefaults(): Promise<void> {
    return this.handleInitCommand(false, true, true, true);
  }
}

describe('VueCLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks.areCredentialsSet.mockReturnValue(true);
    setupMocks.createOrUpdateConfig.mockResolvedValue('gt.config.json');
    setupMocks.getDesiredLocales.mockResolvedValue({
      defaultLocale: 'en',
      locales: ['fr'],
    });
    setupMocks.promptMultiSelect.mockResolvedValue([]);
    setupMocks.searchForPackageJson.mockResolvedValue({
      devDependencies: {
        gt: '^2.16.0',
        'gt-vue': '^0.1.0',
      },
    });
  });

  it.each(['init', 'configure'])(
    'routes %s through loader-free generic configuration',
    async (command) => {
      const program = new Command();
      const cli = new TestVueCLI(program);
      cli.init();

      await program.parseAsync([command], { from: 'user' });

      expect(cli.configure).toHaveBeenCalledOnce();
      expect(cli.configure).toHaveBeenCalledWith(true);
    }
  );

  it.each([
    ['production gt-vue', { dependencies: { 'gt-vue': '*' } }, true],
    ['development gt-vue', { devDependencies: { 'gt-vue': '*' } }, true],
    ['optional gt-vue', { optionalDependencies: { 'gt-vue': '*' } }, false],
    [
      'production and optional gt-vue',
      {
        dependencies: { 'gt-vue': '*' },
        optionalDependencies: { 'gt-vue': '*' },
      },
      false,
    ],
    [
      'development and optional gt-vue',
      {
        devDependencies: { 'gt-vue': '*' },
        optionalDependencies: { 'gt-vue': '*' },
      },
      false,
    ],
    ['production gt-react', { dependencies: { 'gt-react': '*' } }, true],
    ['development gt-react', { devDependencies: { 'gt-react': '*' } }, false],
  ])('applies setup ownership for %s', (_name, manifest, expected) => {
    const cli = new TestVueCLI(new Command());

    expect(cli.detectsInstalledInlineRuntime(manifest)).toBe(expected);
  });

  it.each([
    ['production gt-vue', { dependencies: { 'gt-vue': '*' } }, true],
    ['development gt-vue', { devDependencies: { 'gt-vue': '*' } }, true],
    [
      'optional gt-vue',
      {
        optionalDependencies: { 'gt-vue': '*' },
      },
      false,
    ],
    [
      'production and optional gt-vue',
      {
        dependencies: { 'gt-vue': '*' },
        optionalDependencies: { 'gt-vue': '*' },
      },
      false,
    ],
    [
      'development and optional gt-vue',
      {
        devDependencies: { 'gt-vue': '*' },
        optionalDependencies: { 'gt-vue': '*' },
      },
      false,
    ],
    ['production gt-react', { dependencies: { 'gt-react': '*' } }, true],
    ['development gt-react', { devDependencies: { 'gt-react': '*' } }, false],
  ])(
    'configures %s according to setup ownership',
    async (_name, manifest, expected) => {
      setupMocks.searchForPackageJson.mockResolvedValue(
        withInstalledCLI(manifest)
      );
      const cli = new TestVueCLI(new Command());

      await cli.runSetupWithDefaults();

      const config = setupMocks.createOrUpdateConfig.mock.calls[0]?.[1] as
        | { files?: { gt?: unknown } }
        | undefined;
      if (expected) {
        expect(setupMocks.promptMultiSelect).not.toHaveBeenCalled();
        expect(config?.files?.gt).toEqual({
          output: 'src/_gt/[locale].json',
        });
      } else {
        expect(setupMocks.promptMultiSelect).toHaveBeenCalledOnce();
        expect(config?.files?.gt).toBeUndefined();
      }
    }
  );
});
