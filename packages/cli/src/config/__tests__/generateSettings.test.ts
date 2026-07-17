import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSettings } from '../generateSettings';
import { resolveFiles } from '../../fs/config/parseFilesConfig';
import { determineLibrary } from '../../fs/determineFramework/index.js';
import { logger } from '../../console/logger.js';
import { resolveConfig } from '../resolveConfig.js';

// Mock resolveFiles
vi.mock('../../fs/config/parseFilesConfig', () => ({
  resolveFiles: vi.fn(),
}));

vi.mock('../../fs/determineFramework/index.js', () => ({
  determineLibrary: vi.fn(() => ({
    library: 'base',
    additionalModules: [],
  })),
}));

// Mock other dependencies
vi.mock('../../console/logging.js', () => ({
  logErrorAndExit: vi.fn(),
  displayProjectId: vi.fn(),
  warnApiKeyInConfig: vi.fn(),
}));
vi.mock('../../console/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../fs/config/findGTConfig.js', () => ({
  findGTConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../fs/config/parseGTConfig.js', () => ({
  parseGTConfig: vi.fn().mockResolvedValue({
    defaultLocale: 'en',
    locales: ['fr', 'es'],
  }),
}));

vi.mock('../validateSettings.js', () => ({
  validateSettings: vi.fn(),
}));

vi.mock('../resolveConfig.js', () => ({
  resolveConfig: vi.fn().mockReturnValue({
    config: {
      defaultLocale: 'en',
      locales: ['fr', 'es'],
    },
    path: '/test/gt.config.json',
  }),
}));

vi.mock('../../fs/utils.js', () => ({
  resolveProjectId: vi.fn().mockReturnValue('test-project-id'),
}));

vi.mock('../../utils/gt.js', () => ({
  gt: {
    setConfig: vi.fn(),
  },
}));

vi.mock('../optionPresets.js', () => ({
  generatePreset: vi.fn(),
}));

const mockDetermineLibrary = vi.mocked(determineLibrary);
const mockLogWarning = vi.mocked(logger.warn);
const mockResolveConfig = vi.mocked(resolveConfig);

describe('generateSettings - composite patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveConfig.mockReturnValue({
      config: {
        defaultLocale: 'en',
        locales: ['fr', 'es'],
      },
      path: '/test/gt.config.json',
    });
    vi.mocked(resolveFiles).mockReturnValue({
      resolvedPaths: {},
      placeholderPaths: {},
      transformPaths: {},
      transformFormats: {},
      publishPaths: new Set(),
      unpublishPaths: new Set(),
      parsingFlags: {},
      gtJson: { parsingFlags: {} as unknown },
    });
    mockDetermineLibrary.mockReturnValue({
      library: 'base',
      additionalModules: [],
    });
  });

  it('should extract composite patterns from jsonSchema options and pass to resolveFiles', async () => {
    const options = {
      files: {
        json: { include: ['src/*.json'] },
      },
      options: {
        jsonSchema: {
          'composite-pattern-1': { composite: true },
          'composite-pattern-2': { composite: true },
          'regular-pattern': { composite: false },
          'another-pattern': {},
        },
      },
    };

    await generateSettings(options, '/test/cwd');

    expect(resolveFiles).toHaveBeenCalledWith(
      { json: { include: ['src/*.json'] } },
      'en',
      ['fr', 'es'],
      '/test/cwd',
      ['composite-pattern-1', 'composite-pattern-2'],
      false
    );
  });

  it('should pass empty array when no composite patterns exist', async () => {
    const options = {
      files: {
        json: { include: ['src/*.json'] },
      },
      options: {
        jsonSchema: {
          'regular-pattern-1': { composite: false },
          'regular-pattern-2': {},
        },
      },
    };

    await generateSettings(options, '/test/cwd');

    expect(resolveFiles).toHaveBeenCalledWith(
      { json: { include: ['src/*.json'] } },
      'en',
      ['fr', 'es'],
      '/test/cwd',
      [],
      false
    );
  });

  it('warns when no library or file translation config is found', async () => {
    await generateSettings({}, '/test/cwd');

    expect(mockLogWarning).toHaveBeenCalledWith(
      expect.stringContaining('No package.json or Python project file found')
    );
  });

  it('does not count files.gt as file translation config', async () => {
    await generateSettings(
      {
        files: {
          gt: { output: 'translations/[locale].json' },
        },
      },
      '/test/cwd'
    );

    expect(mockLogWarning).toHaveBeenCalledWith(
      expect.stringContaining('No package.json or Python project file found')
    );
  });

  it('suppresses the warning when file translation config is present', async () => {
    await generateSettings(
      {
        files: {
          gt: { output: 'translations/[locale].json' },
          pot: { include: ['locales/*.pot'] },
        },
      },
      '/test/cwd'
    );

    expect(mockLogWarning).not.toHaveBeenCalledWith(
      expect.stringContaining('No package.json')
    );
  });

  it('should pass empty array when jsonSchema options are not provided', async () => {
    const options = {
      files: {
        json: { include: ['src/*.json'] },
      },
    };

    await generateSettings(options, '/test/cwd');

    expect(resolveFiles).toHaveBeenCalledWith(
      { json: { include: ['src/*.json'] } },
      'en',
      ['fr', 'es'],
      '/test/cwd',
      [],
      false
    );
  });

  it('should pass empty array when options are not provided', async () => {
    const options = {
      files: {
        json: { include: ['src/*.json'] },
      },
      options: undefined,
    };

    await generateSettings(options, '/test/cwd');

    expect(resolveFiles).toHaveBeenCalledWith(
      { json: { include: ['src/*.json'] } },
      'en',
      ['fr', 'es'],
      '/test/cwd',
      [],
      false
    );
  });

  it('reads omitConfigIds from config', async () => {
    mockResolveConfig.mockReturnValue({
      config: {
        defaultLocale: 'en',
        locales: ['fr', 'es'],
        omitConfigIds: true,
      },
      path: '/test/gt.config.json',
    });

    const settings = await generateSettings({}, '/test/cwd');

    expect(settings.omitConfigIds).toBe(true);
  });

  it('reads omitConfigIds from flags', async () => {
    const settings = await generateSettings(
      { omitConfigIds: true },
      '/test/cwd'
    );

    expect(settings.omitConfigIds).toBe(true);
  });

  it('warns when config ids are omitted while publish is enabled', async () => {
    await generateSettings({ omitConfigIds: true, publish: true }, '/test/cwd');

    expect(mockLogWarning).toHaveBeenCalledWith(
      expect.stringContaining('Config IDs will be omitted')
    );
  });

  it('should handle mixed composite and non-composite patterns', async () => {
    const options = {
      files: {
        yaml: { include: ['data/*.yaml'] },
      },
      options: {
        jsonSchema: {
          'pattern-1': { composite: true },
          'pattern-2': { composite: false },
          'pattern-3': { composite: true },
          'pattern-4': { someOtherProperty: true },
        },
      },
    };

    await generateSettings(options, '/project/root');

    expect(resolveFiles).toHaveBeenCalledWith(
      { yaml: { include: ['data/*.yaml'] } },
      'en',
      ['fr', 'es'],
      '/project/root',
      ['pattern-1', 'pattern-3'],
      false
    );
  });

  it('should extract composite patterns only from jsonSchema', async () => {
    const options = {
      files: {
        json: { include: ['src/*.json'] },
        yaml: { include: ['data/*.yaml'] },
      },
      options: {
        jsonSchema: {
          'json-composite-1': { composite: true },
          'json-regular': { composite: false },
        },
        yamlSchema: {
          'yaml-composite-1': { composite: true },
          'yaml-composite-2': { composite: true },
          'yaml-regular': {},
        },
      },
    };

    await generateSettings(options, '/test/cwd');

    expect(resolveFiles).toHaveBeenCalledWith(
      {
        json: { include: ['src/*.json'] },
        yaml: { include: ['data/*.yaml'] },
      },
      'en',
      ['fr', 'es'],
      '/test/cwd',
      ['json-composite-1'],
      false
    );
  });

  it('should not call resolveFiles when files are not provided', async () => {
    const options = {
      options: {
        jsonSchema: {
          'composite-pattern': { composite: true },
        },
      },
    };

    await generateSettings(options, '/test/cwd');

    expect(resolveFiles).not.toHaveBeenCalled();
  });

  it('normalizes uppercase file format config keys before resolving files', async () => {
    const options = {
      files: {
        POT: {
          include: ['locales/[locale]/*.pot'],
          transformationFormat: 'PO',
        },
      },
    };

    await generateSettings(options, '/test/cwd');

    expect(resolveFiles).toHaveBeenCalledWith(
      {
        pot: {
          include: ['locales/[locale]/*.pot'],
          transformationFormat: 'PO',
        },
      },
      'en',
      ['fr', 'es'],
      '/test/cwd',
      [],
      false
    );
  });
});

describe('generateSettings - openapi config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveFiles).mockReturnValue({
      resolvedPaths: {},
      placeholderPaths: {},
      transformPaths: {},
      transformFormats: {},
      publishPaths: new Set(),
      unpublishPaths: new Set(),
      parsingFlags: {},
      gtJson: { parsingFlags: {} as unknown },
    });
  });

  it('does not auto-add jsonSchema entries for openapi files', async () => {
    const settings = await generateSettings({
      options: {
        openapi: {
          framework: 'mintlify',
          files: ['./openapi.json', './discovery-openapi.json'],
        },
      },
    });

    expect(settings.options?.jsonSchema).toBeUndefined();
  });
});
