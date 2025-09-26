import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSettings } from '../generateSettings';
import { resolveFiles } from '../../fs/config/parseFilesConfig';

// Mock resolveFiles
vi.mock('../../fs/config/parseFilesConfig', () => ({
  resolveFiles: vi.fn(),
}));

// Mock other dependencies
vi.mock('../../console/logging.js', () => ({
  logWarning: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  logErrorAndExit: vi.fn(),
  displayProjectId: vi.fn(),
  displayCreatedConfigFile: vi.fn(),
  warnApiKeyInConfig: vi.fn(),
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

vi.mock('../../fs/config/setupConfig.js', () => ({
  createOrUpdateConfig: vi.fn(),
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

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
  },
}));

describe('generateSettings - composite patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveFiles).mockReturnValue({
      resolvedPaths: {},
      placeholderPaths: {},
      transformPaths: {},
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
      ['composite-pattern-1', 'composite-pattern-2']
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
      []
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
      []
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
      []
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
      ['pattern-1', 'pattern-3']
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
      ['json-composite-1']
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
});
