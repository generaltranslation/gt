import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setupMocks = vi.hoisted(() => ({
  areCredentialsSet: vi.fn(),
  createOrUpdateConfig: vi.fn(),
  detectFramework: vi.fn(),
  generateSettings: vi.fn(),
  getDesiredLocales: vi.fn(),
  promptConfirm: vi.fn(),
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

vi.mock('../../setup/detectFramework.js', () => ({
  detectFramework: setupMocks.detectFramework,
}));

vi.mock('../../config/generateSettings.js', () => ({
  generateSettings: setupMocks.generateSettings,
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
    promptConfirm: setupMocks.promptConfirm,
    promptMultiSelect: setupMocks.promptMultiSelect,
  };
});

import type { SupportedLibraries } from '../../types/index.js';
import { Libraries } from '../../types/libraries.js';
import { BaseCLI } from '../base.js';
import { MixedVueCLI, VueCLI } from '../vue.js';

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
}

class TestMixedVueCLI extends MixedVueCLI {
  public readonly initialize = vi.fn(
    async (
      _ranReactSetup: boolean,
      _useDefaults: boolean,
      _isVite: boolean,
      _useBundledDefaults: boolean
    ) => undefined
  );

  protected override handleInitCommand(
    ranReactSetup: boolean,
    useDefaults: boolean = false,
    isVite: boolean = false,
    useBundledTranslationDefaults: boolean = false
  ): Promise<void> {
    return this.initialize(
      ranReactSetup,
      useDefaults,
      isVite,
      useBundledTranslationDefaults
    );
  }
}

class TestBaseCLI extends BaseCLI {
  public constructor(library: SupportedLibraries = Libraries.GT_REACT) {
    super(new Command(), library);
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
    setupMocks.detectFramework.mockResolvedValue({
      name: 'vite',
      type: 'react',
    });
    setupMocks.generateSettings.mockResolvedValue({});
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
});

describe('MixedVueCLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks.detectFramework.mockResolvedValue({ name: undefined });
    setupMocks.generateSettings.mockResolvedValue({});
    setupMocks.promptConfirm.mockResolvedValue(true);
  });

  it('preserves every BaseCLI command and init option while adding Vue commands', () => {
    const baseProgram = new Command();
    const base = new BaseCLI(baseProgram, 'i18next');
    base.init();

    const mixedProgram = new Command();
    const mixed = new MixedVueCLI(mixedProgram);
    mixed.init();

    const baseCommandNames = baseProgram.commands.map((command) =>
      command.name()
    );
    const mixedCommandNames = mixedProgram.commands.map((command) =>
      command.name()
    );
    expect(mixedCommandNames).toEqual(expect.arrayContaining(baseCommandNames));
    expect(mixedCommandNames).toEqual(
      expect.arrayContaining(['generate', 'validate'])
    );

    const getOptionFlags = (program: Command, commandName: string) =>
      program.commands
        .find((command) => command.name() === commandName)
        ?.options.map(({ flags }) => flags);
    expect(getOptionFlags(mixedProgram, 'init')).toEqual(
      getOptionFlags(baseProgram, 'init')
    );
    expect(getOptionFlags(mixedProgram, 'configure')).toEqual(
      getOptionFlags(baseProgram, 'configure')
    );
    expect(getOptionFlags(mixedProgram, 'init')).toEqual(
      expect.arrayContaining(['--src <paths...>', '-c, --config <path>'])
    );
  });

  it('inherits the historical init action and consumes its options', async () => {
    const program = new Command();
    const cli = new TestMixedVueCLI(program);
    cli.init();

    await program.parseAsync(
      ['init', '--src', 'src/**/*.vue', '--config', 'custom.json'],
      { from: 'user' }
    );

    expect(setupMocks.generateSettings).toHaveBeenCalledOnce();
    expect(setupMocks.generateSettings).toHaveBeenCalledWith({
      config: 'custom.json',
      src: ['src/**/*.vue'],
    });
    expect(setupMocks.detectFramework).toHaveBeenCalledOnce();
    expect(cli.initialize).toHaveBeenCalledWith(false, true, false, false);
  });

  it('stops historical initialization when init option validation fails', async () => {
    const validationError = new Error('invalid init settings');
    setupMocks.generateSettings.mockRejectedValue(validationError);
    const program = new Command();
    const cli = new TestMixedVueCLI(program);
    cli.init();

    await expect(
      program.parseAsync(
        ['init', '--src', 'src/**/*.vue', '--config', 'custom.json'],
        { from: 'user' }
      )
    ).rejects.toBe(validationError);

    expect(setupMocks.generateSettings).toHaveBeenCalledWith({
      config: 'custom.json',
      src: ['src/**/*.vue'],
    });
    expect(cli.initialize).not.toHaveBeenCalled();
    expect(setupMocks.detectFramework).not.toHaveBeenCalled();
  });
});

describe('shared inline runtime setup ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks.areCredentialsSet.mockReturnValue(true);
    setupMocks.createOrUpdateConfig.mockResolvedValue('gt.config.json');
    setupMocks.detectFramework.mockResolvedValue({
      name: 'vite',
      type: 'react',
    });
    setupMocks.generateSettings.mockResolvedValue({});
    setupMocks.getDesiredLocales.mockResolvedValue({
      defaultLocale: 'en',
      locales: ['fr'],
    });
    setupMocks.promptMultiSelect.mockResolvedValue([]);
  });

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
    const cli = new TestBaseCLI();

    expect(cli.detectsInstalledInlineRuntime(manifest)).toBe(expected);
  });

  it.each([
    Libraries.GT_NEXT,
    Libraries.GT_REACT,
    Libraries.GT_REACT_NATIVE,
    Libraries.GT_TANSTACK_START,
    Libraries.GT_NODE,
    Libraries.GT_FLASK,
    Libraries.GT_FASTAPI,
    'i18next',
    'next-intl',
  ] as const)(
    'recognizes direct gt-vue configuration from the %s CLI route',
    (library) => {
      const cli = new TestBaseCLI(library);

      expect(
        cli.detectsInstalledInlineRuntime({
          dependencies: { 'gt-vue': '*' },
        })
      ).toBe(true);
      expect(
        cli.detectsInstalledInlineRuntime({
          devDependencies: { 'gt-vue': '*' },
        })
      ).toBe(true);
      expect(
        cli.detectsInstalledInlineRuntime({
          peerDependencies: { 'gt-vue': '*' },
        })
      ).toBe(false);
      expect(
        cli.detectsInstalledInlineRuntime({
          dependencies: { 'gt-vue': '*' },
          optionalDependencies: { 'gt-vue': '*' },
        })
      ).toBe(false);
    }
  );

  it.each([
    Libraries.GT_NEXT,
    Libraries.GT_REACT,
    Libraries.GT_REACT_NATIVE,
    Libraries.GT_TANSTACK_START,
    Libraries.GT_NODE,
    Libraries.GT_I18N,
    Libraries.GT_REACT_CORE,
    Libraries.GT_FLASK,
    Libraries.GT_FASTAPI,
  ] as const)(
    'preserves production-only setup detection for historical runtime %s',
    (library) => {
      const cli = new TestBaseCLI(library);

      expect(
        cli.detectsInstalledInlineRuntime({
          dependencies: { [library]: '*' },
        })
      ).toBe(true);
      expect(
        cli.detectsInstalledInlineRuntime({
          devDependencies: { [library]: '*' },
        })
      ).toBe(false);
    }
  );

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
      const cli = new TestBaseCLI();

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

  it('configures files.gt for production gt-vue beside dev-only gt-react', async () => {
    setupMocks.searchForPackageJson.mockResolvedValue(
      withInstalledCLI({
        dependencies: { 'gt-vue': '*' },
        devDependencies: { 'gt-react': '*' },
      })
    );
    const cli = new TestBaseCLI(Libraries.GT_REACT);

    await cli.runSetupWithDefaults();

    const config = setupMocks.createOrUpdateConfig.mock.calls[0]?.[1] as
      | { files?: { gt?: unknown } }
      | undefined;
    expect(config?.files?.gt).toEqual({
      output: 'src/_gt/[locale].json',
    });
  });
});
